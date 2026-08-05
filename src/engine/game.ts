// The engine facade: state + log + the pump, plus the projection each player
// sees. This is what the renderer (and, in M4, the host session) talks to.

import { assertInvariants } from './invariants';
import { handle } from './handlers';
import { emptyState, replayPrefix, stateHash, type Emitted } from './log';
import { advance, MAX_ITER, type EngineDeps } from './loop';
import { apply } from './reducer';
import { redactBatch } from './redact';
import { newGame, type SetupSpec } from './setup';
import { Projector } from './project';
import { collectTriggers, replacementOptions, runReplacementFunnel } from './triggers';
import { toViewEvents } from './viewEvents';
import type { EventBody, EventCause, GameEvent } from './types/events';
import type { PlayerId } from './types/ids';
import type { HandleResult, Intent, Reject } from './types/intents';
import type { GameState } from './types/state';
import type { EngineEvent, PlayerView } from '../view/types';

/** One unit of engine work, ready for the choreographer. */
export interface ViewBatch {
  readonly stepId: number;
  readonly events: EngineEvent[];
  readonly view: PlayerView;
  /**
   * `state.eventCount` immediately after this group.
   *
   * ⚠️ Per GROUP, not per intent. A `ViewPatch`'s `base`/`next` are event counts,
   * and a client that received one patch per intent would have to collapse
   * several groups into one commit — which is exactly the pairing the
   * choreographer needs kept apart (see the note on `applyBatch`).
   */
  readonly eventCount: number;
}

export interface SubmitOk {
  readonly ok: true;
  readonly events: readonly GameEvent[];
  readonly batches: ViewBatch[];
}

export type SubmitResult = SubmitOk | Reject;

export interface GameOpts {
  /** Run `assertInvariants` after every event. On in dev and in every test. */
  readonly checkInvariants?: boolean;
  /** Whose view the batches carry. Solo play moves this between seats. */
  readonly viewer?: PlayerId;
  /**
   * Every seat a batch is produced for. A solo game has one (the hotseat
   * viewer); a network host has one per seated player, because each of them
   * needs the cues and the view THEIR seat produced.
   */
  readonly viewers?: readonly PlayerId[];
}

export class Game {
  state: GameState;
  /** The ACTIVE log: `replay(log)` always reproduces `state`. */
  log: GameEvent[] = [];
  /**
   * Everything that ever happened, including events a rewind discarded and the
   * `RewoundTo` markers themselves. This is what is written to disk; the ACTIVE
   * log is what replay-equivalence is asserted on.
   */
  history: GameEvent[] = [];
  /** Whose view the emitted batches carry. Solo play rotates it between seats. */
  viewer: PlayerId;

  private readonly projectors = new Map<PlayerId, Projector>();
  private readonly checkInvariants: boolean;
  private viewers: PlayerId[];
  private pending = new Map<PlayerId, ViewBatch[]>();

  constructor(
    readonly deps: EngineDeps,
    readonly seed = 'unseeded',
    opts: GameOpts = {},
  ) {
    this.state = emptyState(seed);
    this.checkInvariants = opts.checkInvariants ?? true;
    this.viewer = opts.viewer ?? 'p1';
    this.viewers = opts.viewers ? [...opts.viewers] : [this.viewer];
    if (!this.viewers.includes(this.viewer)) this.viewers.push(this.viewer);
  }

  static create(spec: SetupSpec, deps: EngineDeps, opts: GameOpts = {}): Game {
    const game = new Game(deps, spec.seed, {
      ...opts,
      viewer: opts.viewer ?? spec.players[0]?.id ?? 'p1',
    });
    game.applyBatch(newGame(spec, game.state.rng), { kind: 'rules' });
    game.pump();
    return game;
  }

  /** Handle an intent, fold its events, then run the engine until it blocks. */
  submit(intent: Intent): SubmitResult {
    const result: HandleResult = handle(this.state, intent, this.deps);
    if (!result.ok) return result;
    const actor = playerOfIntent(intent);
    const cause: EventCause = {
      kind: 'intent',
      ...(actor !== undefined ? { player: actor } : {}),
      intent: intent.t,
    };
    const before = this.log.length;
    this.pending.clear();
    this.applyBatch(
      {
        events: result.events,
        ...(result.rng === undefined ? {} : { rng: result.rng }),
        ...(result.funnelled === true ? { funnelled: true } : {}),
      },
      cause,
    );
    this.pump();
    return { ok: true, events: this.log.slice(before), batches: this.drain() };
  }

  /**
   * Fold events the RULES produced with no intent behind them.
   *
   * ⚠️ The one legitimate caller is presence: a socket closing changes
   * `player.connected`, which the priority loop reads to pause the game (spec
   * Q6). It is a real state change, so it goes through a real event and lands in
   * the log like everything else — never a direct mutation. See the invariant
   * at the top of `types/events.ts`.
   */
  emit(events: readonly EventBody[], cause: EventCause = { kind: 'rules' }): ViewBatch[] {
    this.pending.clear();
    this.applyBatch({ events }, cause);
    this.pump();
    return this.drain();
  }

  /** Run `advance()` until the engine blocks or the game finishes. */
  pump(): GameEvent[] {
    const before = this.log.length;
    for (let i = 0; i < MAX_ITER; i++) {
      const batch = advance(this.state, this.deps);
      if (batch.events.length === 0) return this.log.slice(before);
      this.applyBatch(batch, { kind: 'rules' });
    }
    const tail = this.log
      .slice(-20)
      .map((e) => e.body.t)
      .join(', ');
    throw new Error(
      `pump: exceeded ${MAX_ITER} iterations — the engine is not converging. Last events: ${tail}`,
    );
  }

  /** Take the view batches produced since the last drain, for one viewer. */
  drain(viewer: PlayerId = this.viewer): ViewBatch[] {
    return this.pending.get(viewer) ?? [];
  }

  /**
   * Which seats get a batch.
   *
   * ⚠️ Every extra viewer costs one `project()` per unit of engine work, so a
   * solo game keeps exactly one and rotates it (D42's hotseat); a host keeps one
   * per seated player because each of them needs the cues and the board THEIR
   * seat produced, and re-deriving that later is impossible — the state has
   * moved on by then.
   */
  setViewers(viewers: readonly PlayerId[]): void {
    this.viewers = [...viewers];
    if (!this.viewers.includes(this.viewer)) this.viewers.push(this.viewer);
  }

  /**
   * Fold one batch, running every event through the replacement funnel and then
   * the trigger bus.
   *
   * ⚠️ `applyReplacements` is called HERE and nowhere else. One funnel is what
   * guarantees a replacement effect sees every candidate exactly once; with N
   * call sites it would see some twice and others never.
   *
   * ⚠️ The view for this group is captured NOW, immediately after the fold. The
   * choreographer commits a group's view when that group's animation STARTS, so
   * state leads animation by at most one group — which only works if each group
   * carries the view it produced rather than the latest one.
   */
  private applyBatch(batch: Emitted, cause: EventCause): void {
    const stepId = this.state.stepId + 1;
    const before = this.state;
    const rngBefore = this.state.rng;
    const produced: GameEvent[] = [];
    let seq = this.log.length;

    // ⚠️ **THE FUNNEL CAN NOW STOP MID-BATCH** (CR 616, D148). When two or more
    // replacement effects apply to one event, the affected object's controller
    // chooses which applies first — so the event is HELD, unapplied, and the
    // rest of the batch is parked with it. `settled` is what got through before
    // the question; `pending` is everything still owed.
    //
    // ⚠️ The held event is NOT applied and NOT logged. That is the difference
    // from every other prompt in this engine, and it is forced: D136's
    // apply-then-ask is unavailable when the ORDER changes the outcome.
    const funnel: ReturnType<typeof runReplacementFunnel> =
      batch.funnelled === true
        ? { kind: 'done', events: batch.events }
        : runReplacementFunnel(this.state, this.deps.oracle, this.deps.scripts, batch.events);
    const bodies =
      funnel.kind === 'done'
        ? funnel.events
        : [
            ...funnel.settled,
            { t: 'ReplacementPending', pending: funnel.pending } as const,
            {
              t: 'AwaitingSet',
              awaiting: {
                kind: 'chooseReplacement',
                player: funnel.pending.player,
                options: replacementOptions(
                  this.state,
                  this.deps.oracle,
                  this.deps.scripts,
                  funnel.pending,
                ),
              },
            } as const,
          ];

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (!body) continue;
      const isLast = i === bodies.length - 1;
      const event: GameEvent = {
        seq: seq++,
        stepId,
        body,
        cause,
        ...(batch.rng !== undefined && isLast ? { rngBefore, rngAfter: batch.rng } : {}),
      };
      this.state = apply(this.state, event);
      produced.push(event);
      if (this.checkInvariants) assertInvariants(this.state);
    }

    this.log = [...this.log, ...produced];
    this.history = [...this.history, ...produced];

    const triggers = collectTriggers(before, this.state, produced, this.deps.oracle, this.deps.scripts);
    if (triggers.length > 0) {
      const event: GameEvent = {
        seq: this.log.length,
        stepId,
        body: { t: 'PendingTriggersAdded', triggers },
        cause: { kind: 'trigger' },
      };
      this.state = apply(this.state, event);
      this.log = [...this.log, event];
      this.history = [...this.history, event];
      produced.push(event);
    }

    // ⚠️ One batch PER VIEWER, and each is redacted for that viewer before it
    // becomes cues. `redactBatch` is the funnel that keeps a library order out
    // of the narration stream — see `redact.ts`. In a solo game `viewers` has
    // one entry, so this is exactly the M3 behaviour.
    for (const viewer of this.viewers) {
      const list = this.pending.get(viewer);
      const batch: ViewBatch = {
        stepId,
        events: toViewEvents(redactBatch(produced, viewer), this.state, viewer),
        view: this.view(viewer),
        eventCount: this.state.eventCount,
      };
      if (list) list.push(batch);
      else this.pending.set(viewer, [batch]);
    }
  }

  view(player: PlayerId): PlayerView {
    let projector = this.projectors.get(player);
    if (!projector) {
      projector = new Projector(this.deps.oracle, this.deps.scripts, player);
      this.projectors.set(player, projector);
    }
    return projector.project(this.state);
  }

  /**
   * Switch whose eyes the table is seen through. Solo play is a hotseat (D42).
   *
   * ⚠️ A single-viewer game MOVES its one viewer rather than accumulating them:
   * four viewers means four projections per unit of engine work, and a solo
   * hotseat that quietly grew to four would pay the whole networked cost for a
   * game with one player at the keyboard.
   */
  setViewer(player: PlayerId): PlayerView {
    this.viewer = player;
    if (this.viewers.length <= 1) this.viewers = [player];
    else if (!this.viewers.includes(player)) this.viewers.push(player);
    return this.view(player);
  }

  hash(): string {
    return stateHash(this.state);
  }

  /**
   * Group rewind (D9): re-fold a PREFIX of the log into a fresh state.
   *
   * ⚠️ Not a reducer case, and not a truncation of history. The active log
   * becomes the prefix (so `replay(log)` still reproduces `state`), while
   * `history` keeps every event that ever happened plus a `RewoundTo` marker.
   * A reducer that could move BACKWARDS would break the append-only invariant
   * that reconnect, replay and the trigger bus all rest on.
   */
  rewind(toEventCount: number): boolean {
    if (toEventCount < 0 || toEventCount > this.log.length) return false;
    const next = replayPrefix(this.log, toEventCount, this.seed);
    this.state = next;
    this.log = this.log.slice(0, toEventCount);
    this.history = [
      ...this.history,
      {
        seq: this.history.length,
        stepId: next.stepId,
        body: { t: 'RewoundTo', eventCount: toEventCount, hash: stateHash(next) },
        cause: { kind: 'rewindCompensation' },
      },
    ];
    // Every projector's identity cache now describes a board that no longer
    // exists, and reusing a stale `CardView` would show a card in the wrong zone.
    this.projectors.clear();
    if (this.checkInvariants) assertInvariants(this.state);
    return true;
  }
}

function playerOfIntent(intent: Intent): PlayerId | undefined {
  return 'player' in intent ? intent.player : undefined;
}

export { stateHash };
export type { EngineEvent };
