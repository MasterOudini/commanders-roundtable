// The client session: what every player's UI talks to, host and guest alike.
//
// ⚠️ THIS IS THE ANTI-ACCIDENTAL-CHEATING BOUNDARY, made structural. The host's
// own player runs one of these over a `loopbackPair`, holding the same projected
// `PlayerView` a guest holds. There is no branch anywhere in `src/ui/` for "am I
// the host" — because there is nothing extra to show.
//
// ⚠️ IT NEVER RUNS THE REDUCER (D-NET-1). It applies patches to a view and hands
// the narration to the choreographer. `src/engine/` is present on a guest and
// idle, with two exceptions that are not the reducer: the PAYMENT SOLVER (the
// host ships a `SolveInput`, so the plan a player approves is computed by the
// identical code the host validates with — see `previewCast`), and replay for a
// saved log.
//
// ⚠️ `submit()` IS FIRE AND FORGET, on purpose. A rejection is a message that
// arrives later, so making it a return value would give the host's loopback
// player a synchronous answer and a guest `null` — one shape that lies on one
// side of the wire. Everything the UI needs comes back through `subscribe`.

import { applyPatch, viewHash } from '../engine/diffView';
import { DISGUISE_WARD, buildPaymentProblem, grantedCastTax, wardTaxFrom } from '../engine/mana';
import { NO_ALT, altCount, applyAlternativePayment, assignAlternativePayment, chooseAlternatives, type AltChoice, type ConvokeCandidate } from '../engine/altPayment';
import { faceOf } from '../engine/oracle';
import { suggestPayment } from '../engine/payment';
import { OTHER_PURPOSE, spellPurpose } from '../engine/spend';
import type { LegalAction } from '../engine/legal';
import type { ManaCost, PaymentPlan } from '../engine/types/mana';
import type { InstanceId, PlayerId } from '../engine/types/ids';
import type { Intent, RejectReason } from '../engine/types/intents';
import type { Awaiting, Step, TargetChoice } from '../engine/types/state';
import type { OracleFace, TargetKind, TargetSpec } from '../engine/types/oracle';
import { targetAllowed, type TargetCandidate } from '../engine/targets';
import { SHIPPED_REGISTRY } from '../engine/scripts/registry';
import { emptyView, type EngineEvent, type PlayerView } from '../view/types';
import {
  envelope,
  PROTOCOL_VERSION,
  type ClientToHost,
  type ConnId,
  type DeckSubmission,
  type Envelope,
  type ErrorCode,
  type HostToClient,
  type LobbyView,
  type SessionState,
} from './protocol';
import type { Transport } from './transport';
import { CardPool, fromWirePatch, fromWireView } from './wire';

export interface Rejection {
  readonly reason: RejectReason;
  readonly message: string;
}

export interface ClientSnapshot {
  readonly connected: boolean;
  readonly running: boolean;
  /** This client's own seat. Everything hidden is hidden from THEM. */
  readonly you: PlayerId;
  readonly seats: readonly { readonly id: PlayerId; readonly name: string }[];
  readonly awaiting: Awaiting | null;
  readonly priority: PlayerId | null;
  readonly legal: readonly LegalAction[];
  readonly turn: { readonly number: number; readonly active: PlayerId; readonly step: Step };
  readonly finished: boolean;
  readonly winners: readonly PlayerId[];
  readonly eventCount: number;
  readonly stateHash: string;
  /** The last thing that went wrong, in words, or null. */
  readonly message: string | null;
  /** Bumped on every rejection, so a caller can tell "this one" from "an old one". */
  readonly rejectSeq: number;
  readonly lobby: LobbyView | null;
  readonly presence: Readonly<Record<PlayerId, boolean>>;
}

export interface ChatLine {
  readonly player: PlayerId;
  readonly text: string;
  readonly tHostMs: number;
}

export interface CastPreview {
  readonly card: InstanceId;
  readonly name: string;
  readonly cost: string;
  readonly tax: number;
  readonly hasX: boolean;
  readonly plan: PaymentPlan | null;
  /** Instance ids the plan would tap, for the review highlight. */
  readonly taps: readonly InstanceId[];
  readonly lifePaid: number;
  /** D403 - the kicker cost the face prints (once, or any number of times), and the count this preview priced. */
  readonly kicker: { readonly cost: string; readonly many: boolean } | null;
  readonly kicked: number;
  /** D535 - the buyback mana cost the face prints (CR 702.27), and whether this preview priced it. */
  readonly buyback: { readonly cost: string } | null;
  readonly bought: boolean;
  /** D556 - the replicate cost the face prints (CR 702.56a), and the count this preview priced. */
  readonly replicate: { readonly cost: string } | null;
  readonly replicated: number;
  /** D557 - the conspire the face prints (CR 702.78a) with the creatures that may pay it, and whether this preview conspires. */
  readonly conspire: { readonly candidates: readonly InstanceId[] } | null;
  readonly conspired: boolean;
  /** D585 - the casualty the face prints (CR 702.153a): the creatures that may pay it (power `floor` or greater), and whether this preview pays it (its one sacrifice rides `costPicks.sacrifice`). */
  readonly casualty: { readonly candidates: readonly InstanceId[]; readonly floor: number } | null;
  readonly casualtyPaid: boolean;
  /** D558 - the offspring cost the face prints (CR 702.175a), and whether this preview priced it. */
  readonly offspring: { readonly cost: string } | null;
  readonly offspringPaid: boolean;
  /** D564 - the squad cost the face prints (CR 702.157a), and the count this preview priced. */
  readonly squad: { readonly cost: string } | null;
  readonly squadded: number;
  /**
   * D576 - the cards in hand the offer may splice onto it (CR 702.47) - each one's name, splice cost and target clauses -
   * and the ones this preview priced (the offer's candidates among those asked for, in order).
   */
  readonly splice: { readonly candidates: readonly { readonly id: InstanceId; readonly name: string; readonly cost: string; readonly targets: number }[] } | null;
  readonly spliced: readonly InstanceId[];
  /**
   * D405 - the alternatives the face prints (convoke / improvise / delve) and what this preview
   * priced: `alt` is what the cast will tap or exile (empty lists when the player asked for none),
   * `altAvailable` what the chooser would take if asked, `altProblem` the choice the host would
   * refuse (a name that pays for nothing).
   */
  readonly keywords: { readonly convoke: boolean; readonly improvise: boolean; readonly delve: boolean };
  readonly alt: AltChoice;
  readonly altAvailable: AltChoice;
  readonly altProblem: string | null;
  /**
   * D406 - the additional cost the face prints (`sacrifice a creature`), the picks this preview priced
   * (`costPicks`), and whether the `or pay {M}` alternative stands in for missing picks (`orPaid`).
   */
  readonly additionalCost: { readonly text: string; readonly orPay: string | null } | null;
  readonly costPicks: CostPicks;
  readonly orPaid: boolean;
  /** D408 - the alternative cost the face prints, as the offer carries it, and whether this preview priced it. */
  readonly alternativeCost: { readonly text: string; readonly available: boolean; readonly pickVerb: string | null; readonly pickCount: number; readonly candidates: readonly InstanceId[] } | null;
  readonly alternative: boolean;
  /**
   * D491 - the preview of a GRANTED cast (a `castFree` prompt's card, without paying its mana cost): answered with
   * `AnswerChooseFromZone` and its `cast` elections, never with `CastSpell`. Absent on every offered cast.
   */
  readonly free?: true;
}

/** D406 - the picks a cast names for its additional cost's chooser verb (the intent's own fields). */
export interface CostPicks {
  readonly sacrifice?: readonly InstanceId[];
  readonly discard?: readonly InstanceId[];
  readonly tap?: readonly InstanceId[];
  readonly exileFromGraveyard?: readonly InstanceId[];
  readonly returnToHand?: readonly InstanceId[];
  /** D408 - the pitch of an alternative cost (hand cards to exile). */
  readonly exileFromHand?: readonly InstanceId[];
}
export const NO_PICKS: CostPicks = {};
const picksCount = (p: CostPicks): number => (p.sacrifice?.length ?? 0) + (p.discard?.length ?? 0) + (p.tap?.length ?? 0) + (p.exileFromGraveyard?.length ?? 0) + (p.returnToHand?.length ?? 0);

export interface ClientOptions {
  readonly playerName: string;
  readonly appVersion: string;
  readonly oracleVersion: string;
  readonly resumeToken?: string;
  /** One group of animation cues plus the board it produced. The M2 seam. */
  readonly onBatch?: (events: readonly EngineEvent[], view: PlayerView) => void;
  /** A hard sync: the whole board at once, discarding anything queued. */
  readonly onSnapshot?: (view: PlayerView) => void;
  readonly onChat?: (line: ChatLine) => void;
  readonly onError?: (code: ErrorCode, message: string) => void;
  readonly onDesync?: (record: { eventCount: number; hostHash: string; clientHash: string }) => void;
  /** Non-null once the game is over, so a caller can stop asking. */
  readonly onLobby?: (lobby: LobbyView) => void;
}

const EMPTY_SESSION: SessionState = {
  eventCount: 0,
  awaiting: null,
  priority: null,
  turn: { number: 0, active: 'p1', step: 'untap' },
  finished: false,
  winners: [],
  legal: [],
  solve: { pool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, poolSnow: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, poolRestricted: [], sources: [], lifeAvailable: 0, eventCount: 0 },
  seats: [],
  stateHash: '',
};

export class ClientSession {
  private readonly pool = new CardPool();
  private readonly listeners: ((snapshot: ClientSnapshot) => void)[] = [];
  private view: PlayerView = emptyView('p1');
  private session: SessionState = EMPTY_SESSION;
  private you: PlayerId = 'p1';
  private resume: string | null = null;
  private lobbyView: LobbyView | null = null;
  private presence: Record<PlayerId, boolean> = {};
  private message: string | null = null;
  private rejectSeq = 0;
  private running = false;
  private seq = 0;
  private ack = 0;
  private intentCounter = 0;
  private hostConn: ConnId = 'host';
  private connected = true;
  /** Set while a resync is outstanding, so one bad patch asks exactly once. */
  private resyncPending = false;
  /** The event count we last asked about, so a repaired board never re-asks. */
  private resyncedAt = -1;

  constructor(
    private readonly transport: Transport,
    private readonly opts: ClientOptions,
  ) {
    this.resume = opts.resumeToken ?? null;
    transport.onMessage((env) => this.receive(env));
    transport.onClose(() => {
      this.connected = false;
      this.notify();
    });
    // ⚠️ `Hello` goes out on every READY, not once in the constructor. After a
    // socket dies and comes back it carries the `resumeToken` this client was
    // given, and the host answers with a `Snapshot` — which is the whole of
    // reconnect from this side. A `Hello` sent before the relay's room
    // handshake would be routed nowhere and read as "the host never answered".
    transport.onReady((reconnected) => {
      this.connected = true;
      if (reconnected) this.seq = 0;
      this.hello();
      this.notify();
    });
  }

  // ── outbound ───────────────────────────────────────────────────────────────

  private hello(): void {
    this.send({
      t: 'Hello',
      protocol: PROTOCOL_VERSION,
      appVersion: this.opts.appVersion,
      playerName: this.opts.playerName,
      oracleVersion: this.opts.oracleVersion,
      ...(this.resume !== null ? { resumeToken: this.resume } : {}),
    });
  }

  submit(intent: Intent): void {
    this.intentCounter += 1;
    // ⚠️ The id is per CLIENT, not per intent shape. The host remembers the last
    // one it saw per connection and ignores a repeat, which is what makes a
    // retried send safe — see the idempotence note in `host.ts`.
    this.send({ t: 'Intent', intentId: `${this.you}-${this.intentCounter}`, intent });
  }

  submitDeck(deck: DeckSubmission): void {
    this.send({ t: 'SubmitDeck', deck });
  }

  setReady(ready: boolean): void {
    this.send({ t: 'SetReady', ready });
  }

  chat(text: string): void {
    this.send({ t: 'ChatSend', text });
  }

  ping(nonce: number): void {
    this.send({ t: 'Ping', nonce });
  }

  requestResync(): void {
    // ⚠️ At most one outstanding request, and at most one per event count. The
    // second guard matters because a `Snapshot` clears `resyncPending`, so
    // without it a board that genuinely cannot be reconciled would ask forever
    // instead of failing visibly.
    if (this.resyncPending || this.resyncedAt === this.session.eventCount) return;
    this.resyncPending = true;
    this.resyncedAt = this.session.eventCount;
    this.send({
      t: 'RequestResync',
      haveEventCount: this.session.eventCount,
      viewHash: viewHash(this.view),
    });
  }

  private send(body: ClientToHost): void {
    this.transport.send(
      envelope(this.transport.room, this.transport.connId(), this.hostConn, this.seq++, this.ack, body),
    );
  }

  close(): void {
    this.transport.close('client closed');
  }

  // ── inbound ────────────────────────────────────────────────────────────────

  private receive(env: Envelope): void {
    this.ack = Math.max(this.ack, env.seq);
    const body = env.body as HostToClient;
    switch (body.t) {
      case 'Welcome':
        this.you = body.you;
        this.resume = body.resumeToken;
        this.lobbyView = body.lobby;
        this.opts.onLobby?.(body.lobby);
        this.notify();
        break;

      case 'LobbyUpdate':
        this.lobbyView = body.lobby;
        this.opts.onLobby?.(body.lobby);
        this.notify();
        break;

      case 'DeckReport':
        this.message = body.accepted
          ? `${body.deckName}: ${body.cardCount} cards ready.`
          : `${body.deckName} was not seated. ${body.issues.join(' ')}`;
        this.notify();
        break;

      case 'Snapshot': {
        this.pool.add(body.dict);
        this.view = fromWireView(body.view, this.pool.map());
        this.session = body.session;
        this.running = true;
        this.resyncPending = false;
        this.checkHash(body.viewHash, body.eventCount);
        // A hard sync: the choreographer bumps its epoch and drops anything
        // queued, because those beats describe a board that is no longer true.
        this.opts.onSnapshot?.(this.view);
        this.notify();
        break;
      }

      case 'Update': {
        // ⚠️ THREE CASES, and collapsing them into two costs 4 GB in 20 seconds.
        //
        //  base === ours  → apply it.
        //  base <  ours   → STALE. It was already in flight when a `Snapshot`
        //                   overtook it, so it describes a board we have moved
        //                   past. Drop it silently.
        //  base >  ours   → a genuine gap. Ask for a snapshot, once.
        //
        // Treating "stale" as "gap" produces a resync STORM: the snapshot the
        // client asks for arrives, the frames that were already in the pipe
        // arrive behind it, each one looks like a gap, each one asks for another
        // snapshot, and each snapshot is ~100 KB × four clients. Measured on the
        // real-socket test: out of memory at the 4 GB heap limit within twenty
        // seconds. The loopback tests could never see it, because on loopback
        // nothing is ever in flight.
        if (body.base < this.session.eventCount) break;
        if (body.base > this.session.eventCount) {
          this.requestResync();
          break;
        }
        this.pool.add(body.dict);
        // ⚠️ One `onBatch` PER GROUP, in order. That is the M2 seam: the
        // choreographer commits a group's view when that group's animation
        // starts, so handing it the final board once would commit the end of the
        // sequence before the first beat played.
        for (const group of body.groups) {
          this.view = applyPatch(this.view, fromWirePatch(group.patch, this.pool.map()));
          this.opts.onBatch?.(group.narration, this.view);
        }
        this.session = body.session;
        this.running = true;
        this.checkHash(body.viewHash, body.next);
        this.notify();
        break;
      }

      case 'IntentRejected':
        this.message = body.message;
        this.rejectSeq += 1;
        this.notify();
        break;

      case 'Presence': {
        const next: Record<PlayerId, boolean> = {};
        for (const p of body.players) next[p.id] = p.connected;
        this.presence = next;
        this.notify();
        break;
      }

      case 'ChatPosted':
        this.opts.onChat?.({ player: body.player, text: body.text, tHostMs: body.tHostMs });
        break;

      case 'Pong':
        break;

      case 'Error':
        this.message = body.message;
        this.rejectSeq += 1;
        this.opts.onError?.(body.code, body.message);
        this.notify();
        break;

      default:
        break;
    }
  }

  /**
   * The desync detector, client half.
   *
   * ⚠️ Compared on EVERY update, not sampled. The whole value of the check is
   * that it fires on the first event that diverges rather than five minutes
   * later, when the board is unrecognisable and nobody can say what happened.
   */
  private checkHash(hostHash: string, eventCount: number): void {
    const mine = viewHash(this.view);
    if (mine === hostHash) return;
    this.opts.onDesync?.({ eventCount, hostHash, clientHash: mine });
    this.requestResync();
  }

  // ── what the UI reads ──────────────────────────────────────────────────────

  subscribe(fn: (snapshot: ClientSnapshot) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const at = this.listeners.indexOf(fn);
      if (at >= 0) this.listeners.splice(at, 1);
    };
  }

  private notify(): void {
    const snapshot = this.snapshot();
    for (const fn of [...this.listeners]) fn(snapshot);
  }

  snapshot(): ClientSnapshot {
    return {
      connected: this.connected,
      running: this.running,
      you: this.you,
      seats: this.session.seats,
      awaiting: this.session.awaiting,
      priority: this.session.priority,
      legal: this.session.legal,
      turn: this.session.turn,
      finished: this.session.finished,
      winners: this.session.winners,
      eventCount: this.session.eventCount,
      stateHash: this.session.stateHash,
      message: this.message,
      rejectSeq: this.rejectSeq,
      lobby: this.lobbyView,
      presence: this.presence,
    };
  }

  currentView(): PlayerView {
    return this.view;
  }

  resumeToken(): string | null {
    return this.resume;
  }

  clearMessage(): void {
    if (this.message === null) return;
    this.message = null;
    this.notify();
  }

  /**
   * What auto-tap WOULD do, without doing it.
   *
   * ⚠️ Runs the SAME solver the host validates with, on the SAME input: the host
   * ships its `SolveInput` (which `payment.ts` was deliberately decoupled from
   * `GameState` to allow), so there is no second implementation to drift. A
   * separate "preview" solver is how a player ends up approving one payment and
   * being charged another, which is the single thing an auto-tapper must never
   * do.
   *
   * ⚠️ The commander tax comes from the matching `CastSpell` legal action rather
   * than being recomputed. `legalActions` is the one primitive that decides what
   * is castable, what is affordable and what it costs; a second opinion here
   * would eventually disagree with the highlight on the card.
   */
  /**
   * D369 - the plan a payment prompt would charge, from the SAME solver the host
   * validates with (D53). `null` means this client cannot pay - which the host's
   * own gate should have prevented, since the prompt is raised only while it can.
   */
  previewPayment(cost: ManaCost | null, life: number): { plan: PaymentPlan | null; taps: readonly InstanceId[] } {
    const problem = buildPaymentProblem(cost, 0, [], 0, life);
    // D397 - a payment prompt is neither a spell nor an ability: restricted mana never pays it.
    const plan = suggestPayment(this.session.solve, problem, OTHER_PURPOSE);
    return { plan, taps: plan?.taps.map((t) => t.source) ?? [] };
  }

  previewCast(cardId: InstanceId, xValue = 0, targets: readonly TargetChoice[] = [], kicked = 0, alt: AltChoice | 'auto' = NO_ALT, costPicks: CostPicks = NO_PICKS, alternative = false, buyback = false, replicated = 0, conspired = false, offspring = false, squadded = 0, spliced: readonly InstanceId[] = [], casualty = false): CastPreview | null {
    const action = this.session.legal.find((a) => a.t === 'CastSpell' && a.card === cardId);
    // D491 - no offer while a `castFree` prompt is up (nobody holds priority): the cast it grants is previewed instead.
    if (action?.t !== 'CastSpell') return this.previewGrantedCast(cardId, kicked, costPicks, conspired, casualty);
    const data = this.view.cards[cardId]?.card;
    if (!data) return null;
    const oracleCard = this.pool.oracle().byPrinting(data.scryfallId);
    if (!oracleCard) return null;
    const face = faceOf(oracleCard, action.faceIndex);
    if (!face.manaCost) return null;
    // ⚠️ The ward surcharge has to be in the PREVIEW, not only in the host's
    // charge. D53 — a player must never approve one payment and be charged
    // another, and ward is the first cost in this app that depends on what you
    // are pointing at rather than on the card in your hand. The lookup is the
    // client's own (a `PlayerView`, not a `GameState`); the sum is shared.
    const ward = wardTaxFrom(this.wardFacesFor(targets));
    // D403 - the kick the player announced, priced with the ward (the host prices the same count).
    const kickCost = face.multikickerCost ?? face.kickerCost;
    const kickMana = kicked > 0 && kickCost ? Array.from({ length: face.multikickerCost ? kicked : 1 }, () => kickCost) : [];
    // D535 - the buyback the player announced (the host prices the same cost; a verb buyback's mana piece and life too).
    const buyMana = buyback && face.buybackCost ? [face.buybackCost] : buyback && face.buybackVerb?.mana ? [face.buybackVerb.mana] : [];
    const buyLife = buyback && face.buybackCost === null && face.buybackVerb ? face.buybackVerb.lifeCost : 0;
    // D556 - the replicate count the player announced (the host prices the same cost that many times).
    const repCost = face.replicateCost;
    const repMana = replicated > 0 && repCost ? Array.from({ length: replicated }, () => repCost) : [];
    // D558 - the offspring the player announced (the host prices the same cost).
    const offMana = offspring && face.offspringCost ? [face.offspringCost] : [];
    // D564 - the squad count the player announced (the host prices the same cost that many times).
    const sqCost = face.squadCost;
    const sqMana = squadded > 0 && sqCost ? Array.from({ length: squadded }, () => sqCost) : [];
    // D576 - the cards the player splices onto it, among the offer's candidates (the host prices each one's splice cost).
    const splicing = spliced.filter((id) => (action.spliceCandidates ?? []).includes(id));
    const splMana = splicing.flatMap((id) => { const f = this.faceFor(id); return f?.spliceCost ? [f.spliceCost] : []; });
    // D406 - the additional cost: the life rides the problem; with no pick named and `or pay {M}` printed,
    // the mana stands in (the host prices the same way, D53).
    const add = face.additionalCost;
    // D408 - the alternative cost elected: its mana replaces the mana cost, its life rides the problem, its
    // picks pay its verb (an additional cost with a verb never prints beside one).
    const altc = alternative ? face.alternativeCost : null;
    const orPaid = altc === null && add !== null && add.orPay !== null && picksCount(costPicks) === 0;
    const addMana = orPaid && add?.orPay ? [add.orPay] : [];
    const addLife = (add && !orPaid ? add.lifeCost : 0) + (altc ? altc.lifeCost : 0);
    // D589 - an emerge cast's total cost is less the sacrificed creature's mana value (CR 702.119a): the value the offer
    // ships for the picked creature, priced as the host charges it (D53).
    const emergeCut = altc?.keyword === 'emerge' && costPicks.sacrifice?.length === 1 ? (action.altPickManaValues?.[costPicks.sacrifice[0] ?? ''] ?? 0) : 0;
    const base = buildPaymentProblem(altc ? altc.mana : face.manaCost, xValue, [...ward.mana, ...kickMana, ...buyMana, ...repMana, ...offMana, ...sqMana, ...splMana, ...addMana], action.tax - emergeCut, ward.life + addLife + buyLife);
    // D405 - convoke / improvise / delve: what the view offers, what the player (or the chooser) named,
    // priced by the SAME assignment the host charges with (D53), off the printed colours the view holds.
    const keywords = { convoke: face.convoke, improvise: face.improvise, delve: face.delve };
    const candidates = this.altCandidates(keywords);
    const altAvailable = chooseAlternatives(base, candidates.convoke, candidates.improvise, candidates.delve);
    const chosenAlt = alt === 'auto' ? altAvailable : alt;
    const byId = new Map(candidates.convoke.map((c) => [c.id, c]));
    const assigned = assignAlternativePayment(base, chosenAlt.convoke.map((id) => byId.get(id) ?? { id, colors: [] }), chosenAlt.improvise.length, chosenAlt.delve.length);
    const altProblem = assigned.failed ? `${this.nameOf((assigned.failed.kind === 'convoke' ? chosenAlt.convoke : assigned.failed.kind === 'improvise' ? chosenAlt.improvise : chosenAlt.delve)[assigned.failed.index])} would pay for nothing.` : null;
    const problem = assigned.failed ? base : applyAlternativePayment(base, assigned.paid);
    // D405 - a permanent the cast taps for its alternatives is no mana source for the same cast.
    const tapped = new Set<InstanceId>([...chosenAlt.convoke, ...chosenAlt.improvise, ...(costPicks.tap ?? [])]);
    const solve = tapped.size > 0 ? { ...this.session.solve, sources: this.session.solve.sources.filter((s) => !tapped.has(s.card)) } : this.session.solve;
    // D397 - the SAME purpose the host charges with (D53): the spell this face is cast as.
    const plan = assigned.failed ? null : suggestPayment(solve, problem, spellPurpose(face, action.faceDown === true));
    return {
      card: cardId,
      name: face.name,
      cost: face.manaCost.raw,
      tax: action.tax,
      hasX: action.hasX,
      plan,
      taps: plan?.taps.map((t) => t.source) ?? [],
      lifePaid: plan?.lifePaid ?? 0,
      kicker: kickCost ? { cost: kickCost.raw, many: face.multikickerCost !== null } : null,
      kicked: kickCost ? kicked : 0,
      buyback: face.buybackCost ? { cost: face.buybackCost.raw } : null,
      bought: buyback && (face.buybackCost !== null || face.buybackVerb !== null),
      replicate: repCost ? { cost: repCost.raw } : null,
      replicated: repCost ? replicated : 0,
      conspire: face.conspireVerb !== null ? { candidates: action.conspireCandidates ?? [] } : null,
      conspired: conspired && face.conspireVerb !== null,
      // D585 - the casualty and its one sacrifice (the offer's candidates carry the power floor, D139).
      casualty: face.casualtyVerb !== null ? { candidates: action.casualtyCandidates ?? [], floor: face.casualtyVerb.sacrificeCost?.powerAtLeast ?? 0 } : null,
      casualtyPaid: casualty && face.casualtyVerb !== null && (costPicks.sacrifice?.length ?? 0) === 1,
      offspring: face.offspringCost ? { cost: face.offspringCost.raw } : null,
      offspringPaid: offspring && face.offspringCost !== null,
      squad: sqCost ? { cost: sqCost.raw } : null,
      squadded: sqCost ? squadded : 0,
      splice: action.spliceCandidates !== undefined ? { candidates: action.spliceCandidates.flatMap((id) => { const f = this.faceFor(id); return f?.spliceCost ? [{ id, name: f.name, cost: f.spliceCost.raw, targets: f.targets.length }] : []; }) } : null,
      spliced: splicing,
      keywords,
      alt: altCount(chosenAlt) > 0 ? chosenAlt : NO_ALT,
      altAvailable,
      altProblem,
      additionalCost: add ? { text: add.costText, orPay: add.orPay?.raw ?? null } : null,
      costPicks,
      orPaid,
      alternativeCost: action.alternativeCostText !== undefined ? { text: action.alternativeCostText, available: action.alternativeAvailable === true, pickVerb: action.altPickVerb ?? null, pickCount: action.altPickCount ?? 0, candidates: action.altPickCandidates ?? [] } : null,
      alternative: altc !== null,
    };
  }

  /**
   * D491 - THE GRANTED CAST, previewed: the card a `castFree` prompt up for this viewer lets it cast without paying its
   * mana cost. A granted cast is never offered, so no `CastSpell` action carries its facts - D587: the host ships them for
   * this seat alone (`SessionState.granted`): the cards the grant admits (the answer's own reader - a card outside its
   * bound previews nothing, so its click is answered at once), the board's reduction for each, and the creatures its
   * conspire and its casualty may take (the host's own lists, over derived characteristics). What the cast may still pay
   * (CR 118.9d) is priced as the host prices it - the kick less that reduction (`grantedCastTax`), an additional cost's
   * life - and its plan is the same solver's over the shipped input (D53). A madness cast is not previewed.
   */
  private previewGrantedCast(cardId: InstanceId, kicked: number, costPicks: CostPicks, conspired: boolean, casualty: boolean): CastPreview | null {
    const aw = this.session.awaiting;
    if (aw?.kind !== 'chooseFromZone' || aw.castFree !== true || aw.player !== this.you || aw.madness !== undefined) return null;
    const facts = this.session.granted?.[cardId];
    if (facts === undefined) return null;
    const face = this.faceFor(cardId);
    if (!face?.manaCost) return null;
    const kickCost = face.multikickerCost ?? face.kickerCost;
    const kickMana = kicked > 0 && kickCost ? Array.from({ length: face.multikickerCost ? kicked : 1 }, () => kickCost) : [];
    const add = face.additionalCost;
    const tax = grantedCastTax(facts.reduction, kickMana);
    const problem = buildPaymentProblem(null, 0, kickMana, tax, add ? add.lifeCost : 0);
    // A creature the conspire taps is no mana source for the same cast (the host's `solveWithout`).
    const tapped = new Set<InstanceId>(conspired ? (costPicks.tap ?? []) : []);
    const solve = tapped.size > 0 ? { ...this.session.solve, sources: this.session.solve.sources.filter((s) => !tapped.has(s.card)) } : this.session.solve;
    const plan = suggestPayment(solve, problem, spellPurpose(face, false));
    return {
      card: cardId,
      name: face.name,
      cost: face.manaCost.raw,
      tax,
      hasX: false,
      plan,
      taps: plan?.taps.map((t) => t.source) ?? [],
      lifePaid: plan?.lifePaid ?? 0,
      kicker: kickCost ? { cost: kickCost.raw, many: face.multikickerCost !== null } : null,
      kicked: kickCost ? kicked : 0,
      buyback: null,
      bought: false,
      replicate: null,
      replicated: 0,
      conspire: face.conspireVerb !== null ? { candidates: facts.conspireCandidates ?? [] } : null,
      conspired: conspired && face.conspireVerb !== null,
      casualty: face.casualtyVerb !== null ? { candidates: facts.casualtyCandidates ?? [], floor: face.casualtyVerb.sacrificeCost?.powerAtLeast ?? 0 } : null,
      casualtyPaid: casualty && face.casualtyVerb !== null && (costPicks.sacrifice?.length ?? 0) === 1,
      offspring: null,
      offspringPaid: false,
      squad: null,
      squadded: 0,
      splice: null,
      spliced: [],
      keywords: { convoke: false, improvise: false, delve: false },
      alt: NO_ALT,
      altAvailable: NO_ALT,
      altProblem: null,
      additionalCost: add ? { text: add.costText, orPay: null } : null,
      costPicks,
      orPaid: false,
      alternativeCost: null,
      alternative: false,
      free: true,
    };
  }

  /**
   * D405 - what this viewer could tap or exile for a cast, from the VIEW: their untapped creatures
   * (convoke, with their printed colours), their untapped artifacts (improvise), the cards in their
   * graveyard (delve). A face-down permanent shows no card and is skipped. In id order, so the
   * chooser is deterministic.
   */
  private altCandidates(keywords: { readonly convoke: boolean; readonly improvise: boolean; readonly delve: boolean }): { convoke: ConvokeCandidate[]; improvise: InstanceId[]; delve: InstanceId[] } {
    const convoke: ConvokeCandidate[] = [];
    const improvise: InstanceId[] = [];
    const delve: InstanceId[] = [];
    if (keywords.convoke || keywords.improvise) {
      for (const id of [...(this.view.zones[`bf:${this.you}`] ?? [])].sort()) {
        const card = this.view.cards[id];
        if (!card?.card || card.tapped || card.faceDown || card.controller !== this.you) continue;
        const oracleCard = this.pool.oracle().byPrinting(card.card.scryfallId);
        if (!oracleCard) continue;
        const face = faceOf(oracleCard, card.faceIndex);
        if (keywords.convoke && face.typeLine.types.includes('Creature')) convoke.push({ id, colors: face.colors });
        if (keywords.improvise && face.typeLine.types.includes('Artifact')) improvise.push(id);
      }
    }
    if (keywords.delve) for (const id of [...(this.view.zones[`gy:${this.you}`] ?? [])].sort()) delve.push(id);
    return { convoke, improvise, delve };
  }

  private nameOf(id: InstanceId | undefined): string {
    return (id !== undefined ? this.view.cards[id]?.card?.name : undefined) ?? 'That card';
  }

  /**
   * The faces of every targeted permanent an OPPONENT controls, for the ward tax.
   *
   * ⚠️ Read from the VIEW, exactly like `targetableIds` — that is what makes it
   * work identically on a guest, where no `GameState` exists at all. A permanent
   * on the battlefield is public information, so nothing here can leak.
   */
  private wardFacesFor(targets: readonly TargetChoice[]): { wardCost: ManaCost | null; wardLife: number }[] {
    const out: { wardCost: ManaCost | null; wardLife: number }[] = [];
    for (const target of targets) {
      if (target.kind !== 'card') continue;
      const card = this.view.cards[target.id];
      if (!card) continue;
      if (card.controller === this.you) continue;
      if (!(this.view.zones[`bf:${card.controller}`] ?? []).includes(target.id)) continue;
      // D460 - a face-down permanent: ward {2} when disguised (the public flag), nothing otherwise (CR 708.2).
      if (card.faceDown) {
        if (card.disguised) out.push(DISGUISE_WARD);
        continue;
      }
      // D575 - the view's DERIVED wards (printed and granted) - the host's own sum, not face 0's.
      out.push(...(card.wards ?? []));
    }
    return out;
  }

  /**
   * Every object and player that could be pointed at, with its KIND.
   *
   * ⚠️ Derived from the VIEW, never from state. That is what makes it work
   * identically on a guest, and it removes the last place the table read a
   * `GameState`.
   *
   * ⚠️ Its predecessor `targetableIds()` promised "any object in a public zone,
   * plus any living player" in its own doc comment and returned NO players — and
   * its stack entries were the instance ids of cards on the stack rather than
   * `StackId`s, so they could not be sent as `{kind:'stack'}` at all and an
   * ability on the stack was invisible.
   */
  targetables(): TargetChoice[] {
    const out: TargetChoice[] = [];
    for (const [id, zone] of Object.entries(this.view.zones)) {
      if (!zone) continue;
      if (id.startsWith('bf:') || id.startsWith('gy:') || id.startsWith('exile:')) {
        for (const card of zone) out.push({ kind: 'card', id: card });
      }
    }
    for (const item of this.view.stack) out.push({ kind: 'stack', id: item.stackItemId });
    for (const player of this.view.seatOrder) {
      if (this.view.seats[player]?.lost) continue;
      out.push({ kind: 'player', id: player });
    }
    return out;
  }

  /**
   * Exactly what THIS spell or ability may be pointed at, per its parsed clauses.
   *
   * ⚠️ The client's own opinion, computed from a `PlayerView` — the host
   * re-validates and wins. It runs the SAME predicate the host does
   * (`targetAllowed`), so the two can only disagree where the underlying facts
   * differ: the client reads PRINTED keywords through its printing pool, while
   * the host reads DERIVED ones. With zero card scripts shipping those are the
   * same thing; where they ever differ the host's rejection is shown, which is
   * the staleness contract `suggestPayment`/`validatePlan` already lives under.
   */
  legalTargetsFor(specs: readonly TargetSpec[], sourceCard: InstanceId): TargetChoice[] {
    const face = this.faceFor(sourceCard);
    // D341 - the source's own power and toughness, for a clause that compares
    // against it ("with lesser power", Mentor). The view's numbers are the
    // DERIVED ones, and only a permanent on the battlefield carries them - the
    // host's rule (loop.ts), so the veil and the host agree on the same board.
    const cv = this.view.cards[sourceCard];
    const onBattlefield = this.view.seatOrder.some((p) => (this.view.zones[`bf:${p}`] ?? []).includes(sourceCard));
    // CR 115.5 - the one object aimed while it is ON the stack is the one my live prompt asks about (a trigger's
    // targets, a copy's new ones): never its own target, as the host rules (`chooseTriggerTargets`, `chooseCopyTargets`).
    const prompt = this.session.awaiting;
    const live = prompt?.kind === 'chooseTargets' && prompt.player === this.you && prompt.source === sourceCard ? prompt : null;
    const src = {
      controller: this.you,
      // D587 - and in the colours the host aims it with: a recoloured spell copy's, carried by that prompt - the copy's
      // reflexive trigger (CR 603.7d) or the copy's new targets (CR 707.10c) - never the copied card's printed face.
      colors: live?.sourceColors ?? face?.colors ?? [],
      // D356 - the same type line the host reads, so the veil and the host agree about a
      // protection from a card type rather than disagreeing at the submit.
      typeLine: face?.typeLine,
      power: onBattlefield ? (cv?.power ?? null) : null,
      toughness: onBattlefield ? (cv?.toughness ?? null) : null,
      // D414 - `another target X` refuses the source itself; the client says which it is.
      sourceId: sourceCard,
      stackId: live?.stackId ?? null,
      // D606 - the defending player its attacker is attacking (CR 508.5), read as the host reads it (`defendingPlayerOf`): the
      // source's own lane, its host's, else the one player this combat attacks.
      defending: this.defendingFromView(sourceCard),
    };
    const candidates = this.candidatesFromView();
    const seen = new Set<string>();
    const out: TargetChoice[] = [];
    for (const spec of specs) {
      for (const c of candidates) {
        if (!targetAllowed(spec, src, c)) continue;
        const key = `${c.choice.kind}:${c.choice.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c.choice);
      }
    }
    return out;
  }

  /**
   * D606 - the DEFENDING PLAYER for a source, off the view as the host reads it off the state (`defendingPlayerOf`):
   * `CardView.attacking` is the player each attacker attacks (a permanent defender's controller), so the source's own lane,
   * then its host's, else the one player this combat attacks (CR 508.5a); otherwise none.
   */
  private defendingFromView(source: InstanceId): PlayerId | null {
    const cards = this.view.cards;
    const own = cards[source];
    if (own?.attacking) return own.attacking;
    const host = own?.attachedTo ? cards[own.attachedTo] : undefined;
    if (host?.attacking) return host.attacking;
    const all = new Set<PlayerId>();
    for (const c of Object.values(cards)) if (c?.attacking) all.add(c.attacking);
    return all.size === 1 ? ([...all][0] ?? null) : null;
  }

  /**
   * What the app understood of a card whose text it could only partly read.
   *
   * ⚠️ Returns null for an `auto` card — that one already did the whole thing
   * itself, and offering to do it again would double it — and for a `manual`
   * one, where there is nothing to offer.
   */
  assistedEffectsFor(cardId: InstanceId): { name: string; lines: string[] } | null {
    const face = this.faceFor(cardId);
    if (!face || face.effectMode !== 'assisted' || face.effects.length === 0) return null;
    // ⚠️ A SHIPPED SPELL DEF ALREADY RAN THE WHOLE CARD — `effectMode` is a
    // PARSE-time property, so a scripted spell whose text the vocabulary only
    // partly reads still says `assisted` here, and offering that half again
    // would run it TWICE. The registry ships in the bundle, so the client can
    // ask it directly with no wire change (loop.ts's seam carries the mirror
    // comment).
    const data = this.view.cards[cardId]?.card;
    const oracleCard = data ? this.pool.oracle().byPrinting(data.scryfallId) : null;
    if (oracleCard && SHIPPED_REGISTRY.spell(oracleCard.oracleId)) return null;
    return { name: face.name, lines: face.effects.map((e) => e.text) };
  }

  /** The parsed target clauses of a card in hand, or of one of its abilities. */
  targetSpecsFor(cardId: InstanceId, abilityIndex?: number, grantRef?: string, spliced: readonly InstanceId[] = []): readonly TargetSpec[] {
    // D367 - a GRANTED ability is not on the recipient's face: its parsed body
    // lives on the provider's def (`ActivatedDef.granted`), which ships in the
    // bundle exactly as the spell defs D187 reads here do.
    if (grantRef !== undefined) {
      const script = SHIPPED_REGISTRY.get(grantRef.slice(0, grantRef.indexOf('#')));
      return script?.activated?.find((d) => d.ref === grantRef)?.granted?.targets ?? [];
    }
    const face = this.faceFor(cardId);
    if (!face) return [];
    // D576 - a cast with cards spliced onto it aims at their clauses after its own (the host's castTargetSpecs).
    if (abilityIndex === undefined) return spliced.length > 0 ? [...face.targets, ...spliced.flatMap((id) => this.faceFor(id)?.targets ?? [])] : face.targets;
    return face.activated[abilityIndex]?.targets ?? [];
  }

  private faceFor(cardId: InstanceId): OracleFace | null {
    const data = this.view.cards[cardId]?.card;
    if (!data) return null;
    const oracleCard = this.pool.oracle().byPrinting(data.scryfallId);
    if (!oracleCard) return null;
    return faceOf(oracleCard, this.view.cards[cardId]?.faceIndex ?? 0);
  }

  /**
   * The client-side adapter for the shared legality predicate.
   *
   * ⚠️ Only PUBLIC zones and living players. A candidate list that reached into a
   * hand would be a redaction leak in the one place the UI is guaranteed to draw.
   */
  private candidatesFromView(): TargetCandidate[] {
    const out: TargetCandidate[] = [];
    const push = (id: InstanceId, zone: 'battlefield' | 'graveyard' | 'exile'): void => {
      const cv = this.view.cards[id];
      const data = cv?.card;
      if (!cv || !data) return;
      const oracleCard = this.pool.oracle().byPrinting(data.scryfallId);
      if (!oracleCard) return;
      const face = faceOf(oracleCard, cv.faceIndex);
      // ⚠️ A card type only counts while the object is ON THE BATTLEFIELD —
      // "target creature" is a creature PERMANENT, and a creature card in a
      // graveyard is a different clause. Must match `targets.kindsFromTypes`
      // exactly, or the veil lights up something the host will reject.
      const types = face.typeLine.types;
      const kinds: TargetKind[] = [];
      if (zone === 'battlefield') {
        if (types.includes('Creature')) kinds.push('creature');
        if (types.includes('Planeswalker')) kinds.push('planeswalker');
        if (types.includes('Battle')) kinds.push('battle');
        if (types.includes('Artifact')) kinds.push('artifact');
        if (types.includes('Enchantment')) kinds.push('enchantment');
        if (types.includes('Land')) kinds.push('land');
        kinds.push('permanent');
      } else {
        kinds.push('card');
      }
      out.push({
        choice: { kind: 'card', id },
        zone,
        controller: cv.controller,
        kinds,
        types,
        /**
         * ⚠️ **THE VIEW'S P/T, NOT THE PRINTING'S** (D139). `CardView.power` is
         * documented as "CURRENT power/toughness after counters and effects",
         * which is exactly what the host computes with `derive()` — and the two
         * adapters MUST agree, or the aim veil lights up a creature the host
         * then refuses. Reading `face.power` here would disagree on every
         * pumped creature.
         *
         * ⚠️ Mana value comes from the ORACLE CARD, not the face: a split card's
         * faces each have their own cost, and `manaValue` is the whole card's.
         */
        manaValue: oracleCard.manaValue,
        power: cv.power,
        toughness: cv.toughness,
        colors: face.colors,
        // ⚠️ PRINTED keywords, exactly as `hexproof` below reads them: the view
        // carries no derived keyword list, so a granted flying disagrees with
        // the host here the same way a granted hexproof already does (D289).
        keywords: face.keywords,
        // The view already projects both marks (D291), so this one agrees
        // with the host exactly.
        combat: { attacking: cv.attacking !== null, blocking: cv.blocking.length > 0 },
        supertypes: face.typeLine.supertypes,
        subtypes: face.typeLine.subtypes,
        tapped: cv.tapped,
        isToken: cv.isToken,
        hexproof: face.keywords.includes('hexproof'),
        shroud: face.keywords.includes('shroud'),
        protection: face.protection,
      });
    };
    for (const player of this.view.seatOrder) {
      for (const id of this.view.zones[`bf:${player}`] ?? []) push(id, 'battlefield');
      for (const id of this.view.zones[`gy:${player}`] ?? []) push(id, 'graveyard');
      for (const id of this.view.zones[`exile:${player}`] ?? []) push(id, 'exile');
    }
    for (const item of this.view.stack) {
      /**
       * ⚠️ A SPELL ON THE STACK HAS A MANA VALUE and 504 lines restrict on it
       * (`Disdainful Stroke`) — AND CARD TYPES: "counter target artifact
       * spell" restricts on those (D198), read from the FACE actually cast
       * exactly as the host adapter reads them, or the veil lights up a spell
       * the host then refuses. `instanceId` is null for an activated or
       * triggered ability, which genuinely has neither.
       *
       * ⚠️ And null for a COPY of a spell (D487), which has both: its printing
       * and face ride the view (`copyOf`) and are read here exactly as the host
       * reads `StackObject.copyOf` - without them the veil refused a copy that
       * "target instant spell" or "target red spell" admits on the host.
       */
      const copied = item.copyOf ? this.pool.oracle().byPrinting(item.copyOf.printingId) : undefined;
      const spellFace = item.instanceId ? this.faceFor(item.instanceId) : copied && item.copyOf ? faceOf(copied, item.copyOf.faceIndex) : null;
      out.push({
        choice: { kind: 'stack', id: item.stackItemId },
        zone: 'stack',
        controller: item.controller,
        // A spell (a copy too) or an ability, as the host adapter reads `StackObject.kind` - never one for the other.
        kinds: item.kind === 'spell' ? ['spell'] : ['ability'],
        types: spellFace?.typeLine.types ?? [],
        manaValue: item.instanceId
          ? (this.pool.oracle().byPrinting(this.view.cards[item.instanceId]?.card?.scryfallId ?? '')?.manaValue ?? null)
          : (copied?.manaValue ?? null),
        power: null,
        toughness: null,
        // D295: a spell's colours, read exactly as the host adapter reads them - a copy's own where the copying clause
        // set them (Fork's red copy).
        colors: spellFace ? (item.copyOf?.colors ?? spellFace.colors) : [],
        keywords: [],
        combat: { attacking: false, blocking: false },
        supertypes: spellFace?.typeLine.supertypes ?? [],
        subtypes: spellFace?.typeLine.subtypes ?? [],
        tapped: false,
        isToken: false,
        hexproof: false,
        shroud: false,
        protection: { colors: [], fromEverything: false, other: [] },
      });
    }
    for (const player of this.view.seatOrder) {
      if (this.view.seats[player]?.lost) continue;
      out.push({
        choice: { kind: 'player', id: player },
        zone: 'player',
        controller: player,
        kinds: ['player'],
        types: [],
        manaValue: null,
        power: null,
        toughness: null,
        colors: [],
        keywords: [],
        combat: { attacking: false, blocking: false },
        supertypes: [],
        subtypes: [],
        tapped: false,
        isToken: false,
        hexproof: false,
        shroud: false,
        protection: { colors: [], fromEverything: false, other: [] },
      });
    }
    return out;
  }
}
