// `advance()` — one unit of engine work. `pump()` — repeat until blocked.
//
// ⚠️ THE ORDER IN `advance()` IS THE RULES. State-based actions, then the
// trigger drain, then the input check, then turn-based actions, then priority.
// CR 117.5 says SBAs and triggers are handled whenever a player *would* receive
// priority, repeatedly, until none apply — and BEFORE they actually get it.
// Making those the first two branches and having `pump()` loop is what makes
// that closure structural instead of a hand-rolled `while` in one call site
// that somebody eventually forgets to call.
//
// ⚠️ `advance()` returns `[]` in exactly two situations: the game is finished,
// or it is blocked on a human (`priority.awaiting !== null`). Those are the only
// two places the engine stops.

import { assignBlockerDamage, creaturesInCombat, canAttack, legalDefenders, needsFirstStrikeSubstep, resolveCombatDamage } from './combat';
import { derive, makeDeriveCache } from './derive';
import { drewCardsMarker, effectResult } from './effects';
import { candidatesFromState, minimumLegalTargets, targetAllowed, untargetableByRule, type TargetingSource } from './targets';
import { checkGameOver, checkStateBasedActions } from './sba';
import { emitted, type Emitted } from './log';
import { faceOf } from './oracle';
import { n, narrated, their, they, vb, who } from './narrate';
import { drawFromTop, mulligansComplete } from './setup';
import { orderTriggersApnap } from './triggers';
import { grantsPriority, nextStep, skipsFirstDraw } from './turn';
import { shouldAutoPass, legalActions } from './legal';
import type { ActivatedDef, ScriptCtx, TriggerDef } from './scripts/api';
import type { ScriptRegistry } from './scripts/registry';
import type { EventBody, GameEvent, ResolvedDamage } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import { EMPTY_POOL, poolTotal } from './types/mana';
import type { RngState } from './rng';
import type { OracleDb, OracleFace, TargetSpec } from './types/oracle';
import { apnapOrder, livingPlayers, type Awaiting, type GameState, type PendingTrigger, type StackObject } from './types/state';
import { canBlock } from './combat';

export interface EngineDeps {
  readonly oracle: OracleDb;
  readonly scripts: ScriptRegistry;
}

/** Exceeding this is a bug, not a long game. The throw carries the tail. */
export const MAX_ITER = 10_000;

export function advance(state: GameState, deps: EngineDeps): Emitted {
  if (state.gamePhase === 'finished' || state.gamePhase === 'lobby') return emitted([]);
  if (state.gamePhase === 'mulligan') return advanceMulligan(state);

  // 1 — state-based actions. Repeat until a pass yields nothing (CR 704.4);
  // `pump` provides the repetition.
  const sba = checkStateBasedActions(state, deps.oracle, deps.scripts);
  if (sba.actions.length > 0) {
    const events = [...sba.events];
    // CR 514.3a — an SBA during cleanup means players DO get priority, and
    // another cleanup step follows.
    if (state.turn.step === 'cleanup' && !state.turn.cleanupNeedsRepeat) {
      events.push({ t: 'CleanupRepeatSet', value: true });
    }
    return emitted(events);
  }

  const over = state.seating.length > 1 ? checkGameOver(state) : [];
  if (over.length > 0) return emitted(over);

  // 2 — trigger drain, APNAP (CR 603.3b).
  if (state.pendingTriggers.length > 0) return drainTriggers(state, deps);

  // 3 — blocked on a human. The engine stops here and nowhere else.
  if (state.priority.awaiting !== null) return emitted([]);

  // 4 — turn-based actions for this step.
  if (!state.turn.turnBasedActionsDone) return turnBasedActions(state, deps);

  // 5 — priority.
  return priority(state, deps);
}

// ── mulligan phase ───────────────────────────────────────────────────────────

function advanceMulligan(state: GameState): Emitted {
  if (mulligansComplete(state)) {
    const startingPlayer = state.turn.activePlayer;
    return emitted([
      { t: 'GamePhaseChanged', phase: 'playing' },
      { t: 'AwaitingSet', awaiting: null },
      { t: 'TurnBegan', turnNumber: 1, activePlayer: startingPlayer },
      narrated(
        state.seating.length === 2
          // "they skip" and "you skip" are the same verb form, so there is no
          // verb part here — only the pronouns change.
          ? n`Turn 1 — ${who(state, startingPlayer)}. ${they(startingPlayer)} skip ${their(startingPlayer)} first draw (CR 103.7b).`
          // "their" here is everyone's, not this player's, so it stays literal.
          : n`Turn 1 — ${who(state, startingPlayer)}. Everyone draws on their first turn (CR 103.7a).`,
        startingPlayer,
      ),
      { t: 'StepBegan', phase: 'beginning', step: 'untap' },
    ]);
  }
  // ⚠️ Bottoming outranks deciding. A player who kept but still owes cards to
  // the bottom is NOT waiting to keep, and re-arming the keep/mulligan prompt
  // over their bottoming prompt made the game unwinnable-looking: the "put 2 on
  // the bottom" dialog vanished the instant it appeared, every time.
  const owing = state.seating.filter((id) => {
    const p = state.players[id];
    return !!p && p.mulligan.kept && p.mulligan.toBottom > 0;
  });
  const head = owing[0];
  if (head) {
    const count = state.players[head]?.mulligan.toBottom ?? 0;
    const current = state.priority.awaiting;
    if (current?.kind === 'mulliganBottom' && current.player === head && current.count === count) {
      return emitted([]);
    }
    return emitted([{ t: 'AwaitingSet', awaiting: { kind: 'mulliganBottom', player: head, count } }]);
  }

  const pending = state.seating.filter((id) => !(state.players[id]?.mulligan.kept ?? true));
  const submitted = state.seating.filter((id) => !pending.includes(id));
  const current = state.priority.awaiting;
  if (
    current?.kind === 'mulligan' &&
    sameIds(current.players, pending) &&
    sameIds(current.submitted, submitted)
  ) {
    return emitted([]);
  }
  return emitted([{ t: 'AwaitingSet', awaiting: { kind: 'mulligan', players: pending, submitted } }]);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => b[i] === x);
}

// ── triggers ─────────────────────────────────────────────────────────────────

function drainTriggers(state: GameState, deps: EngineDeps): Emitted {
  const ordered = orderTriggersApnap(state, state.pendingTriggers);
  const byController = new Map<PlayerId, typeof ordered>();
  for (const t of ordered) byController.set(t.controller, [...(byController.get(t.controller) ?? []), t]);

  // CR 603.3b — a controller putting two or more simultaneous triggers on the
  // stack CHOOSES their order. Walk the controllers in APNAP order: every group
  // BEFORE the first one that owes a choice has its stack position settled
  // whatever the answer turns out to be, so it goes on now; the owing
  // controller is asked; everyone after waits their turn, still pending.
  //
  // ⚠️ The prefix-stacking is not cosmetic. The previous shape stacked NOTHING
  // until every group was a singleton — so a single-trigger ACTIVE player
  // behind a prompted non-active one would have gone on the stack AFTER the
  // answer, above the answered triggers, which reverses CR 603.3b's order.
  const ready: PendingTrigger[] = [];
  let demand: Awaiting | null = null;
  for (const [controller, list] of byController) {
    if (list.length >= 2) {
      demand = { kind: 'orderTriggers', player: controller, triggers: list.map((t) => t.id) };
      break;
    }
    ready.push(...list);
  }

  if (demand === null) return emitted(stackPendingTriggers(state, deps, ordered).events);

  const prefix = stackPendingTriggers(state, deps, ready);
  // A targeted trigger in the prefix raised its own prompt — one question at a
  // time (`AwaitingSet` holds exactly one). The rest stay pending; the next
  // `advance()` re-enters here.
  if (prefix.stopped) return emitted(prefix.events);

  // ⚠️ THE RE-RAISE GUARD (`advanceMulligan`'s idiom), and the reason this
  // function was rewritten: the owing controller's triggers STAY PENDING while
  // the question is up, and this drain runs BEFORE `advance()`'s awaiting
  // check — so without the guard the next iteration re-entered here and
  // re-emitted the same `AwaitingSet` forever. Pump's 10,000-iteration throw,
  // reached by the FIRST two simultaneous same-controller script triggers this
  // engine ever produced: two tokens entering under a Soul Warden (D158).
  // Never emit over ANY live prompt from here — its own included.
  const events = prefix.events;
  if (state.priority.awaiting === null) events.push({ t: 'AwaitingSet', awaiting: demand });
  return emitted(events);
}

/**
 * Put pending triggers on the stack, in the order GIVEN — the caller decides
 * what that order means (APNAP from the drain above; the controller's own
 * answer from the `OrderTriggers` handler).
 *
 * ⚠️ ONE implementation, two callers (D148's rule). The handler re-implementing
 * "fill targets, build the object, narrate, clear" is how the two would come to
 * disagree — and before D158 the handler had NO stacking at all, so an answered
 * ordering was immediately re-asked by the next drain, forever.
 *
 * ⚠️ APNAP puts the ACTIVE player's triggers on the stack first, so the
 * non-active player's end up on top and resolve first. Reversing this is the
 * classic off-by-one in a trigger bus, and it is invisible until two triggers
 * fight over the same object.
 */
export function stackPendingTriggers(
  state: GameState,
  deps: EngineDeps,
  ordered: readonly PendingTrigger[],
): { events: EventBody[]; stopped: boolean } {
  const events: EventBody[] = [];
  const drained: string[] = [];
  let stackCounter = state.counters.stack;
  for (const trigger of ordered) {
    // ⚠️ CR 603.3d — A TRIGGER WITH NO LEGAL TARGET IS REMOVED FROM THE STACK,
    // so it never goes on in the first place. This is the rule AND it is what
    // stops the prompt below from being a wedge: a trigger has no `pendingCast`
    // to cancel, so a driver handed an unanswerable targets prompt would have
    // no legal reply at all and the game would stop forever. D102's exact
    // shape, prevented rather than recovered from.
    if (trigger.specs.length > 0) {
      const src = targetingSourceFor(state, deps, trigger.source, trigger.controller);
      const fill = src
        ? minimumLegalTargets(trigger.specs, src, candidatesFromState(state, deps))
        : null;
      if (!fill) {
        drained.push(trigger.id);
        events.push(
          narrated(
            n`${trigger.label} — no legal target, so it is removed from the stack (CR 603.3d).`,
            trigger.controller,
          ),
        );
        continue;
      }
    }
    stackCounter++;
    const obj: StackObject = {
      id: `s${stackCounter}`,
      kind: 'triggered',
      // An ability is a chit, not a card — there is no face to be. See D155.
      faceIndex: 0,
      controller: trigger.controller,
      card: null,
      source: trigger.source,
      abilityRef: trigger.abilityRef,
      targets: [],
      modes: [],
      xValue: null,
      label: trigger.label,
      identity: [],
      taxApplied: 0,
      isCommanderCast: false,
      castFrom: null,
      // The per-item firing's subject rides through to `resolve` (D190).
      ...(trigger.item !== undefined ? { item: trigger.item } : {}),
    };
    events.push({ t: 'AbilityPutOnStack', obj });
    events.push(
      narrated(n`${who(state, trigger.controller)}: ${trigger.label}`, trigger.controller),
    );
    drained.push(trigger.id);

    // ⚠️ CR 603.3d — TARGETS ARE CHOSEN AS THE ABILITY IS PUT ON THE STACK, so
    // the object goes on and the question is asked in the same uninterruptible
    // pass. Nobody can act in the gap: an `Awaiting` blocks every intent
    // (D136's precedent, where a permanent has likewise already entered while
    // its prompt is up).
    //
    // ⚠️ AND THE DRAIN STOPS HERE. Everything after this trigger stays pending
    // and is drained by the next `advance`, because a second prompt cannot be
    // raised while this one is up — `AwaitingSet` holds exactly one. Draining
    // them all first and then asking would need somewhere to keep the specs of
    // an object already on the stack, which is a field on `GameState` bought to
    // avoid one extra pass through a loop that already exists.
    if (trigger.specs.length > 0) {
      const awaiting: Awaiting = {
        kind: 'chooseTargets',
        player: trigger.controller,
        stackId: obj.id,
        count: trigger.specs.reduce((sum, s) => sum + s.min, 0),
        source: trigger.source,
        label: trigger.label,
        specs: trigger.specs,
        forKind: 'trigger',
      };
      events.push({ t: 'PendingTriggersCleared', ids: drained });
      events.push({ t: 'AwaitingSet', awaiting });
      return { events, stopped: true };
    }
  }
  // Nothing to clear when the caller's list was empty (the drain's ready
  // prefix can be), and an empty `ids` would be a marker meaning nothing.
  if (drained.length > 0) events.push({ t: 'PendingTriggersCleared', ids: drained });
  return { events, stopped: false };
}

// ── turn-based actions (CR 703) ──────────────────────────────────────────────

function turnBasedActions(state: GameState, deps: EngineDeps): Emitted {
  const events: EventBody[] = [];
  const ap = state.turn.activePlayer;

  switch (state.turn.step) {
    case 'untap': {
      const toUntap = state.zones.battlefield.filter((id) => {
        const card = state.cards[id];
        return !!card && card.controller === ap && card.tapped && !card.phasedOut;
      });
      if (toUntap.length > 0) events.push({ t: 'PermanentsUntapped', cards: toUntap });
      events.push(narrated(n`Turn ${state.turn.turnNumber} — ${who(state, ap)}.`, ap));
      break;
    }

    case 'draw': {
      if (!skipsFirstDraw(state)) {
        const library = state.zones.library[ap] ?? [];
        if (library.length === 0) {
          // CR 704.5b: the loss happens on the NEXT state-based-action check,
          // not now, so a replacement effect has a window.
          events.push({ t: 'DrewFromEmptyLibrary', player: ap });
          events.push(
            narrated(
              // "cannot" is a modal — one form for both persons, so no verb part.
              n`${who(state, ap)} cannot draw — ${their(ap)} library is empty.`,
              ap,
            ),
          );
        } else {
          const drawn = drawFromTop(ap, 1, library);
          events.push(...drawn);
          // The REAL-draw marker (D189) — the draw step is one of exactly two
          // sites; `drawEvents` is the other. Opening hands never mark.
          const marker = drewCardsMarker(ap, drawn);
          if (marker) events.push(marker);
          events.push(narrated(n`${who(state, ap)} ${vb(ap, 'draws', 'draw')} a card.`, ap));
        }
      }
      break;
    }

    case 'beginCombat':
      events.push({ t: 'CombatBegan' });
      break;

    case 'declareAttackers': {
      const deps2 = { state, oracle: deps.oracle, scripts: deps.scripts, cache: makeDeriveCache(state) };
      const possible = state.zones.battlefield.filter((id) => canAttack(deps2, id));
      if (possible.length === 0) {
        // No prompt when there is nothing to decide. On a four-player table this
        // removes one forced click per player per turn.
        events.push({ t: 'AttackersDeclared', attackers: [] });
        events.push({ t: 'FirstStrikeSubstepDecided', needed: false });
      } else {
        // ⚠️ The prompt carries the legal choices because a client cannot
        // compute them: `canAttack` and `legalDefenders` read a `GameState` no
        // client holds. Until this shipped the UI hardcoded "the first
        // opponent", so nobody at a 3–4 player table could choose whom they
        // attacked — the engine had supported per-attacker defenders all along.
        events.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'declareAttackers',
            player: ap,
            attackers: possible,
            defenders: legalDefenders(deps2, ap),
          },
        });
        return emitted(events);
      }
      break;
    }

    case 'declareBlockers': {
      const combat = state.combat;
      if (!combat || combat.attackers.length === 0) {
        events.push({ t: 'BlockersDeclared', blocks: [] });
        events.push({ t: 'FirstStrikeSubstepDecided', needed: needsFirstStrikeSubstep({ state, ...deps }) });
        break;
      }
      const prompt = blockPrompt(state, deps);
      if (prompt.players.length === 0) {
        events.push({ t: 'BlockersDeclared', blocks: [] });
        events.push({ t: 'FirstStrikeSubstepDecided', needed: needsFirstStrikeSubstep({ state, ...deps }) });
        break;
      }
      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'declareBlockers',
          players: prompt.players,
          submitted: [],
          legal: prompt.legal,
        },
      });
      return emitted(events);
    }

    case 'firstStrikeDamage':
    case 'combatDamage': {
      const substep = state.turn.step === 'firstStrikeDamage' ? 'firstStrike' : 'regular';
      const damages = resolveCombatDamage({ state, ...deps, cache: makeDeriveCache(state) }, substep);
      if (damages.length > 0) {
        events.push({ t: 'CombatDamageDealt', substep, damages });
        events.push(...damageSideEffects(state, damages));
      }
      break;
    }

    default:
      break;
  }

  events.push({ t: 'TurnBasedActionsDone' });
  return emitted(events);
}

/**
 * Who gets asked to block, and — in the SAME pass — exactly which of their
 * creatures may block which attackers.
 *
 * ⚠️ The matrix is returned rather than recomputed because the pairing was
 * already being calculated here to decide who to prompt at all; throwing it away
 * and having a client guess at it is what made an aim veil impossible for
 * blocks. `canBlock` reads DERIVED keywords, so no client can reproduce it.
 */
function blockPrompt(
  state: GameState,
  deps: EngineDeps,
): { players: PlayerId[]; legal: { blocker: InstanceId; attackers: InstanceId[] }[] } {
  const combat = state.combat;
  if (!combat) return { players: [], legal: [] };
  const cache = makeDeriveCache(state);
  const cdeps = { state, oracle: deps.oracle, scripts: deps.scripts, cache };
  const players: PlayerId[] = [];
  const legal: { blocker: InstanceId; attackers: InstanceId[] }[] = [];

  for (const id of state.seating) {
    if (state.players[id]?.hasLost) continue;
    const defendsSomething = combat.attackers.some((a) =>
      a.defender.kind === 'player'
        ? a.defender.id === id
        : state.cards[a.defender.id]?.controller === id,
    );
    if (!defendsSomething) continue;

    let any = false;
    for (const bid of state.zones.battlefield) {
      if (state.cards[bid]?.controller !== id) continue;
      const attackers = combat.attackers
        .filter((a) => canBlock(cdeps, bid, a.card) === null)
        .map((a) => a.card);
      if (attackers.length === 0) continue;
      legal.push({ blocker: bid, attackers });
      any = true;
    }
    // ⚠️ A player with no LEGAL block is auto-submitted with an empty
    // declaration rather than prompted. Otherwise the whole table waits on
    // someone whose only creature is tapped, with no way to say "I can't".
    if (any) players.push(id);
  }
  return { players, legal };
}

/**
 * Life loss, commander tallies and the log lines that come out of a damage
 * event. The damage marks themselves are folded by the reducer.
 */
export function damageSideEffects(state: GameState, damages: readonly ResolvedDamage[]): EventBody[] {
  const events: EventBody[] = [];
  const tally = new Map<string, number>();
  for (const damage of damages) {
    if (!damage.isCommanderDamage || damage.target.kind !== 'player') continue;
    const key = `${damage.target.id}|${damage.source}`;
    tally.set(key, (tally.get(key) ?? 0) + damage.amount);
  }
  for (const [key, amount] of tally) {
    const cut = key.indexOf('|');
    const player = key.slice(0, cut);
    const from = key.slice(cut + 1);
    const before = state.players[player]?.commanderDamage[from] ?? 0;
    events.push({ t: 'CommanderDamageDealt', player, from, amount, total: before + amount });
  }
  return events;
}

// ── priority ─────────────────────────────────────────────────────────────────

/**
 * ⚠️ Granting priority and DECIDING what to do with it are two separate
 * iterations, deliberately.
 *
 * The first emits `PriorityGranted` and nothing else; the next sees the granted
 * state and either auto-passes or stops. The alternative — deciding both in one
 * batch — means `shouldAutoPass` has to run against a state that does not yet
 * say who has priority, and `legalActions` (which checks exactly that) returns
 * an empty list, so every player auto-passes always. Splitting it also gives
 * the same code path to "a player just cast something and still holds
 * priority" (CR 117.3c), which otherwise needs its own branch.
 */
function priority(state: GameState, deps: EngineDeps): Emitted {
  if (!grantsPriority(state)) return endStep(state, deps);

  const living = livingPlayers(state);
  if (living.length === 0) return emitted([]);
  const passed = state.priority.passedSinceLastAction;
  const holder = state.priority.player;

  if (holder !== null && living.includes(holder) && !passed.includes(holder)) {
    // ⚠️ HoldPriority suppresses auto-pass until the holder actually PASSES,
    // not for exactly one action as the spec sketched. Clearing it after one
    // action means a player who holds priority, casts a spell, and then has
    // nothing else affordable is auto-passed instantly — which is the exact
    // situation the toggle exists to prevent, and makes the button look broken.
    // It is a toggle in the UI, so it behaves like one. See DECISIONS D36.
    if (state.priority.holdingPriority === holder) return emitted([]);
    // ⚠️ A disconnected player PAUSES the game indefinitely (spec Q6) rather
    // than being auto-passed. Anyone may click "pass for <name>", and every
    // such pass is a logged event — the right mechanism under a friends-only
    // trust model: social, visible, and undoable by rewind.
    if (state.players[holder]?.connected === false) return emitted([]);
    if (shouldAutoPass(state, deps.oracle, deps.scripts, holder)) {
      return emitted([{ t: 'PriorityPassed', player: holder, auto: true, forced: false }]);
    }
    return emitted([]);
  }

  if (living.every((p) => passed.includes(p))) {
    if (state.stack.length > 0) return resolveTop(state, deps);
    return endStep(state, deps);
  }

  const order = apnapOrder(state).filter((p) => living.includes(p));
  const next = order.find((p) => !passed.includes(p));
  if (!next) return endStep(state, deps);
  return emitted([{ t: 'PriorityGranted', player: next, stackSize: state.stack.length }]);
}

function endStep(state: GameState, deps: EngineDeps): Emitted {
  const events: EventBody[] = [{ t: 'StepEnded', phase: state.turn.phase, step: state.turn.step }];

  // CR 500.4 — mana pools empty at the end of every step and every phase.
  for (const id of state.seating) {
    const p = state.players[id];
    if (!p || poolTotal(p.pool) === 0) continue;
    events.push({ t: 'ManaPoolEmptied', player: id, lost: p.pool });
  }

  if (state.turn.step === 'endCombat' && state.combat) {
    const inCombat = creaturesInCombat(state);
    if (inCombat.length > 0) events.push({ t: 'RemovedFromCombat', cards: inCombat });
    events.push({ t: 'CombatEnded' });
  }

  if (state.turn.step === 'cleanup') {
    // CR 514.3a — repeat the cleanup step if anything happened during it.
    if (state.turn.cleanupNeedsRepeat) {
      events.push({ t: 'CleanupRepeatSet', value: false });
      events.push({ t: 'StepBegan', phase: 'ending', step: 'cleanup' });
      return emitted(events);
    }
    return emitted([...events, ...beginNextTurn(state)]);
  }

  const next = nextStep(state);
  if (!next) return emitted([...events, ...beginNextTurn(state)]);

  // Cleanup's own turn-based actions, emitted as the step begins, because there
  // is no priority round in which to do them.
  events.push({ t: 'StepBegan', phase: next.phase, step: next.step });
  if (next.step === 'cleanup') {
    const damaged = state.zones.battlefield.filter((id) => (state.cards[id]?.damage ?? 0) > 0);
    if (damaged.length > 0) events.push({ t: 'DamageCleared', cards: damaged });
    // CR 514.2 — "until end of turn" effects end here, in the same turn-based
    // action that wipes damage. A Giant Growth that outlived its turn would make
    // every subsequent combat wrong, quietly.
    if (state.untilEndOfTurn.length > 0) events.push({ t: 'UntilEndOfTurnEnded' });
  }
  void deps;
  return emitted(events);
}

function beginNextTurn(state: GameState): EventBody[] {
  const living = livingPlayers(state);
  if (living.length === 0) return [{ t: 'GameEnded', winners: [] }];
  const order = state.seating;
  const at = order.indexOf(state.turn.activePlayer);
  let nextPlayer = living[0] as PlayerId;
  for (let i = 1; i <= order.length; i++) {
    const candidate = order[(at + i) % order.length];
    if (candidate && living.includes(candidate)) {
      nextPlayer = candidate;
      break;
    }
  }
  return [
    { t: 'TurnBegan', turnNumber: state.turn.turnNumber + 1, activePlayer: nextPlayer },
    { t: 'StepBegan', phase: 'beginning', step: 'untap' },
  ];
}

// ── resolving the top of the stack ───────────────────────────────────────────

function resolveTop(state: GameState, deps: EngineDeps): Emitted {
  const obj = state.stack[state.stack.length - 1];
  if (!obj) return emitted([]);
  const events: EventBody[] = [];

  if (obj.card !== null) {
    const card = state.cards[obj.card];
    if (!card) return emitted([{ t: 'StackResolved', stackId: obj.id, card: null, to: null, targets: obj.targets, controller: obj.controller }]);
    const oracleCard = deps.oracle.byPrinting(card.printingId);
    const face = oracleCard ? faceOf(oracleCard, card.faceIndex) : null;

    if (!targetsStillLegal(state, deps, obj, face)) {
      // CR 608.2b — a spell whose targets are all illegal is removed from the
      // stack and does nothing. It goes to the graveyard, not to exile.
      events.push({ t: 'SpellFizzled', stackId: obj.id });
      events.push({
        t: 'CardsMoved',
        moves: [{ card: obj.card, from: { kind: 'stack', player: null }, to: { kind: 'graveyard', player: card.owner } }],
      });
      events.push(
        narrated(`${obj.label} is countered on resolution — no legal targets.`, obj.controller, obj.identity),
      );
      return emitted(events);
    }

    const to = face?.isPermanent
      ? { kind: 'battlefield' as const, player: obj.controller }
      : { kind: 'graveyard' as const, player: card.owner };
    events.push({ t: 'StackResolved', stackId: obj.id, card: obj.card, to, targets: obj.targets, controller: obj.controller });
    // ⚠️ THE EFFECT RUNS BEFORE THE CARD MOVES. A spell is still on the stack
    // while it resolves (CR 608.2), so its own text can point at the board it is
    // about to leave — and, concretely, a Bolt that had already been put into the
    // graveyard would have no source for its damage.
    //
    // ⚠️ Only `auto`. A partly-understood card does nothing here and is offered
    // to the player instead: half-executing is the one outcome worse than not
    // executing at all. See `effectParse.ts`.
    // ⚠️ `effectResult`, not `effectEvents`: a clause may consume randomness
    // ("discards two cards at random"), and the RNG advances ONLY through a
    // recorded `rngAfter`. Dropping it here would replay the game to a different
    // board than it was played on — silently, and only for those cards.
    //
    // ⚠️ A SHIPPED SPELL DEF OUTRANKS THE VOCABULARY, and exactly ONE of the
    // two runs. A def claims the card's WHOLE text (the coverage accounting
    // refuses partial claims, D90), so running `effectResult` after it would
    // double every clause the parser also understood. The def inherits this
    // spot's two guarantees: the card is still ON the stack (CR 608.2), and
    // fizzle was decided above (CR 608.2b). `client.assistedEffectsFor`
    // carries the mirror rule — a scripted spell must never ALSO raise the
    // assisted offer, or the parsed half runs twice.
    let rng: RngState | undefined;
    const spellDef = oracleCard ? deps.scripts.spell(oracleCard.oracleId) : undefined;
    if (spellDef) {
      events.push(...spellDef.resolve(scriptCtxFor(state, deps), obj.card, obj));
    } else if (face && face.effectMode === 'auto' && face.effects.length > 0) {
      const result = effectResult(state, deps, obj, face.effects);
      events.push(...result.events);
      rng = result.rng;
    }
    events.push({
      t: 'CardsMoved',
      // ⚠️ The SPELL's face, carried onto the permanent it becomes — CR 712.
      // Without it a modal DFC resolves and `clearBattlefieldFields` puts its
      // front face on the battlefield. See D155.
      moves: [
        {
          card: obj.card,
          from: { kind: 'stack', player: null },
          to,
          ...(obj.faceIndex === 0 ? {} : { faceIndex: obj.faceIndex }),
        },
      ],
    });
    // CR 303.4g — an Aura SPELL enters attached to the object it targeted.
    // ⚠️ This was MISSING: the resolved Aura sat unattached for exactly one
    // sweep and SBA 704.5m binned it — measured live as "Ana casts Pacifism.
    // Pacifism resolves. Pacifism dies." (D198), the cast path charging
    // {1}{W} for a dead enchantment, ever since the sweep learned that an
    // unattached Aura is illegal. AFTER the move, because the entry's
    // `clearBattlefieldFields` resets `attachedTo`. A single-target Aura
    // whose target went away never reaches here (fizzle, above); a
    // player-enchanting Curse has no InstanceId to attach to and keeps
    // today's outcome.
    if (face?.isPermanent && face.typeLine.subtypes.includes('Aura')) {
      const enchanted = obj.targets[0];
      if (
        enchanted &&
        enchanted.kind === 'card' &&
        state.cards[enchanted.id]?.zone.kind === 'battlefield'
      ) {
        events.push({ t: 'AttachmentChanged', card: obj.card, to: enchanted.id });
      }
    }
    events.push(narrated(`${obj.label} resolves.`, obj.controller, obj.identity));
    return emitted(events, rng);
  }

  // An ability. With no card scripts there is nothing to run, but the object
  // still leaves the stack — which is what stops a triggered ability from
  // wedging the priority loop forever.
  const def = triggerDefFor(deps, obj);

  // CR 603.1 — "you may". A "may" trigger uses the stack like any other and the
  // CHOICE is made by its controller on RESOLUTION, which is why this is here
  // and not in `drainTriggers`. See D128.
  if (def?.optional === true && obj.source !== null) {
    // ⚠️ NEVER ASK A PLAYER WHO IS OUT OF THE GAME. Their answer is not in
    // doubt — a departed player chooses nothing — and CR 800.4a goes further,
    // removing their objects from the stack outright, which this engine does
    // not model. So the ability resolves having done nothing.
    //
    // ⚠️ Whether the prompt could be ANSWERED depends on the client, and that
    // is the argument for not raising it: the test harness answers on the
    // departed seat's behalf, so removing this guard does not hang the suite —
    // it hands a live question to somebody who has left the table, and which
    // clients still speak for that seat is not a property `src/engine/` can
    // see. D102's rule, applied one step earlier than usual.
    if (!(state.players[obj.controller]?.hasLost ?? true)) {
      const awaiting: Awaiting = {
        kind: 'optionalTrigger',
        player: obj.controller,
        stackId: obj.id,
        source: obj.source,
        label: obj.label,
      };
      return emitted([{ t: 'AwaitingSet', awaiting }]);
    }
    return emitted(resolveAbility(state, deps, obj, false));
  }

  return emitted(resolveAbility(state, deps, obj, null));
}

/** The `TriggerDef` behind a stack object, or undefined for anything else. */
function triggerDefFor(deps: EngineDeps, obj: StackObject): TriggerDef | undefined {
  if (!obj.abilityRef) return undefined;
  const script = deps.scripts.get(obj.abilityRef.slice(0, obj.abilityRef.indexOf('#')));
  return script?.triggers?.find((t) => `${script.oracleId}#${t.abilityId}` === obj.abilityRef);
}

/**
 * The `ActivatedDef` behind an ACTIVATED stack object, or undefined (D159).
 * The join is `def.ref === obj.abilityRef` — the exact
 * `${oracleId}#a${index}` string `handlers.activateAbility` wrote — which is
 * also why a trigger's `abilityId` may never match /^a\d+$/ (D158's review
 * rule): `triggerDefFor` above would claim the activated object first.
 */
function activatedDefFor(deps: EngineDeps, obj: StackObject): ActivatedDef | undefined {
  if (obj.kind !== 'activated' || !obj.abilityRef) return undefined;
  const script = deps.scripts.get(obj.abilityRef.slice(0, obj.abilityRef.indexOf('#')));
  return script?.activated?.find((d) => d.ref === obj.abilityRef);
}

/**
 * The one `ScriptCtx` construction — every def kind resolves through the same
 * context, so a field added for one cannot silently stay a stub for another
 * (how `ctx.random` rotted unnoticed, D158's reportable — still a stub, still
 * said).
 */
function scriptCtxFor(state: GameState, deps: EngineDeps): ScriptCtx {
  const cache = makeDeriveCache(state);
  // ⚠️ ADVANCING allocators, one pair per ctx — a pure read of the unapplied
  // state hands the SAME id to every call in one resolve, so a script creating
  // two tokens overwrote the first and duplicated the zone entry (found by
  // Beetleback Chief / Blaze Commando, D164). The first call is byte-identical
  // to the old read, so every single-allocation script replays unchanged;
  // `effects.ts`'s createToken has kept its own advancing counter since D133
  // for exactly this reason.
  let instAlloc = state.counters.instance;
  let stackAlloc = state.counters.stack;
  return {
    state,
    oracle: deps.oracle,
    derive: (id: InstanceId) => derive(state, deps.oracle, deps.scripts, id, cache),
    options: state.options,
    ids: {
      nextInstance: () => `c${++instAlloc}`,
      nextStack: () => `s${++stackAlloc}`,
    },
    query: {
      permanentsOf: (player: PlayerId) =>
        state.zones.battlefield.filter((id) => state.cards[id]?.controller === player),
      controllerOf: (id: InstanceId) => state.cards[id]?.controller ?? null,
      isOnBattlefield: (id: InstanceId) => state.cards[id]?.zone.kind === 'battlefield',
    },
    random: { below: () => 0, shuffled: <T,>(xs: readonly T[]) => xs },
  };
}

/**
 * Resolve an ability off the top of the stack.
 *
 * ⚠️ ONE IMPLEMENTATION, TWO CALLERS. `resolveTop` calls it for every ability;
 * `handlers.answerOptionalTrigger` calls it with the player's answer, because a
 * "may" trigger stops mid-resolution and comes back through an intent. A second
 * copy of "an ability leaves the stack, runs its script and narrates" would
 * eventually disagree with this one about the order of those three, and the
 * difference would only ever show up on a card that killed its own source.
 *
 * @param answer `null` for an ability that was never optional — run it, and say
 *   nothing about a decision nobody made. `true`/`false` are a "may" trigger's
 *   answer, and each writes its own line: a declined trigger and a trigger whose
 *   effect happened to do nothing leave an identical board, so the log is the
 *   only place that difference can live.
 */
export function resolveAbility(
  state: GameState,
  deps: EngineDeps,
  obj: StackObject,
  answer: boolean | null,
): EventBody[] {
  const events: EventBody[] = [
    { t: 'StackResolved', stackId: obj.id, card: null, to: null, targets: obj.targets, controller: obj.controller },
  ];
  const def = triggerDefFor(deps, obj);

  // ⚠️ CR 608.2b — AN ABILITY WHOSE EVERY TARGET IS ILLEGAL DOES NOT RESOLVE.
  // The board moves between the moment targets are chosen and the moment the
  // ability resolves (that is the whole reason targeting is two steps), so a
  // trigger aimed at a creature somebody killed in response must do nothing at
  // all rather than run its script against a card in a graveyard.
  //
  // ⚠️ "EVERY", not "any" — a partial fizzle still resolves for the targets
  // that survive, and it is the script's job to skip the dead ones. This only
  // catches the total case, which is the one with a rule of its own.
  const srcCard = obj.source ? state.cards[obj.source] : undefined;
  const srcPrinting = srcCard ? deps.oracle.byPrinting(srcCard.printingId) : undefined;
  const srcFace = srcCard && srcPrinting ? faceOf(srcPrinting, srcCard.faceIndex) : null;
  if (obj.targets.length > 0 && !targetsStillLegal(state, deps, obj, srcFace, def?.targets ?? [])) {
    events.push(
      narrated(
        n`${obj.label} — no legal target left, so it does not resolve (CR 608.2b).`,
        obj.controller,
      ),
    );
    return events;
  }

  if (answer !== false && def && obj.source) {
    events.push(...def.resolve(scriptCtxFor(state, deps), obj.source, obj));
  }

  // ⚠️ THE ACTIVATED SEAM (D159). Until this branch, `ActivatedDef` was a dead
  // field: the registry never indexed it, and this function's only script
  // lookup was `triggerDefFor` — so `legal.ts` offered a payable ability,
  // `handlers.ts` charged its whole cost, and the resolution ran nothing
  // (D122's disclosed gap, now closed for any ability a def claims by `ref`).
  // `obj.source` may point at a GRAVEYARD card here — a self-sacrifice cost
  // (Hedron Archive) pays the source away before the ability resolves, which
  // is why a def's `resolve` must read `obj.controller` and never assume the
  // battlefield.
  const adef = activatedDefFor(deps, obj);
  if (adef && obj.source !== null) {
    events.push(...adef.resolve(scriptCtxFor(state, deps), obj.source, obj));
  }
  if (answer !== null) {
    events.push(
      narrated(
        answer
          ? n`${who(state, obj.controller)} ${vb(obj.controller, 'uses', 'use')} ${obj.label}.`
          : n`${who(state, obj.controller)} ${vb(obj.controller, 'declines', 'decline')} ${obj.label}.`,
        obj.controller,
      ),
    );
  }
  events.push(narrated(`${obj.label} resolves.`, obj.controller, obj.identity));
  return events;
}

/**
 * CR 608.2b — a spell fizzles only when EVERY target is illegal. `.some()` is
 * therefore correct and a two-target spell that lost one still resolves.
 *
 * ⚠️ Now runs the SAME predicate declaration ran (`targetAllowed`), against the
 * spell's own parsed clauses. The old check looked only at the zone and admitted
 * graveyard and exile for everything — harmless while spells did nothing, and a
 * real bug the moment they did: a Bolt aimed at a creature that had been exiled
 * in response still resolved and marked damage on a card outside the
 * battlefield, which `checkInvariants` caught as "has damage outside the
 * battlefield". A target that changed zones is a NEW object (CR 400.7) and is
 * never still legal.
 */
/**
 * What ward and protection measure a triggered ability against: its SOURCE's
 * colours, and its controller.
 *
 * ⚠️ The source is the permanent whose ability triggered, not a card on the
 * stack — a triggered ability has no card of its own (CR 113.7a), which is why
 * `StackObject.card` is null for one.
 */
function targetingSourceFor(
  state: GameState,
  deps: EngineDeps,
  source: InstanceId | null,
  controller: PlayerId,
): TargetingSource | null {
  if (!source) return null;
  const card = state.cards[source];
  const printing = card ? deps.oracle.byPrinting(card.printingId) : undefined;
  if (!card || !printing) return null;
  return { controller, colors: faceOf(printing, card.faceIndex).colors };
}

function targetsStillLegal(
  state: GameState,
  deps: EngineDeps,
  obj: StackObject,
  face: OracleFace | null,
  // ⚠️ A TRIGGERED ABILITY'S CLAUSES LIVE ON ITS `TriggerDef`, NOT ON THE FACE.
  // Its source's printed `targets` are the card's own spell clauses, which for
  // a permanent is an empty list — so without this a trigger fell to the
  // "no parsed clause" branch and every restriction the def declared went
  // unchecked at resolution, having been enforced when they were chosen.
  specsOverride?: readonly TargetSpec[],
): boolean {
  if (obj.targets.length === 0) return true;
  const specs = specsOverride ?? face?.targets ?? [];
  const candidates = candidatesFromState(state, deps);
  const src = { controller: obj.controller, colors: face?.colors ?? [] };
  return obj.targets.some((target) => {
    const candidate = candidates.find(
      (c) => c.choice.kind === target.kind && c.choice.id === target.id,
    );
    if (!candidate) return false;
    // ⚠️ NOT `specs[i]` (D288). Targets are a flat list that the validator
    // assigned to clauses by SEARCH (`assignTargets`), never by position —
    // so a spell whose optional clause precedes a required one ("up to two
    // target creatures … Target player draws two cards") cast with zero
    // creatures used to have its player checked against the creature clause
    // and fizzle. CR 608.2b asks whether the target is still legal for the
    // clause it answers; the answer is "some clause of this object admits
    // it" — the same kind-and-restriction test, over every clause.
    // No parsed clause (a free-aim card, or an ability) still gets the CR
    // restrictions — shroud and protection do not stop applying because the
    // parser could not read the sentence.
    if (specs.length === 0) return !untargetableByRule(src, candidate);
    return specs.some((spec) => targetAllowed(spec, src, candidate));
  });
}

// ── the driver ───────────────────────────────────────────────────────────────

export interface PumpResult {
  readonly state: GameState;
  readonly log: readonly GameEvent[];
  readonly events: readonly GameEvent[];
}

/**
 * Run the engine until it blocks or finishes.
 *
 * ⚠️ `stepId` advances once per `advance()` call, so every event ONE unit of
 * engine work produced shares a group in the choreographer. That is the
 * difference between a table that reads as a sequence and one where everything
 * happens at once.
 *
 * ⚠️ Hitting MAX_ITER is a BUG, not a long game, and the throw carries the last
 * twenty events. The alternative — silently returning — is a hang with no
 * evidence, which is the single worst failure mode a loop like this can have.
 */
export function pump(
  state: GameState,
  log: readonly GameEvent[],
  deps: EngineDeps,
  onCommit: (state: GameState, log: readonly GameEvent[], batch: Emitted, stepId: number) => PumpResult,
): PumpResult {
  let current: PumpResult = { state, log, events: [] };
  const produced: GameEvent[] = [];
  for (let i = 0; i < MAX_ITER; i++) {
    const batch = advance(current.state, deps);
    if (batch.events.length === 0) {
      return { state: current.state, log: current.log, events: produced };
    }
    const stepId = current.state.stepId + 1;
    current = onCommit(current.state, current.log, batch, stepId);
    produced.push(...current.events);
  }
  const tail = produced.slice(-20).map((e) => e.body.t).join(', ');
  throw new Error(
    `pump: exceeded ${MAX_ITER} iterations — the engine is not converging. Last events: ${tail}`,
  );
}

/** Blocker damage from a specific blocker, exposed for the combat tests. */
export { assignBlockerDamage };

/** Whether a player currently has any legal action other than passing. */
export function hasAnyAction(state: GameState, deps: EngineDeps, player: PlayerId): boolean {
  return legalActions(state, deps.oracle, deps.scripts, player).some((a) => a.t !== 'PassPriority');
}

export { EMPTY_POOL };
