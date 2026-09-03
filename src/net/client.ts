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
import { buildPaymentProblem, wardTaxFrom } from '../engine/mana';
import { faceOf } from '../engine/oracle';
import { suggestPayment } from '../engine/payment';
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
}

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
  solve: { pool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, sources: [], lifeAvailable: 0, eventCount: 0 },
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
  previewCast(cardId: InstanceId, xValue = 0, targets: readonly TargetChoice[] = []): CastPreview | null {
    const action = this.session.legal.find((a) => a.t === 'CastSpell' && a.card === cardId);
    if (action?.t !== 'CastSpell') return null;
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
    const problem = buildPaymentProblem(face.manaCost, xValue, ward.mana, action.tax, ward.life);
    const plan = suggestPayment(this.session.solve, problem);
    return {
      card: cardId,
      name: face.name,
      cost: face.manaCost.raw,
      tax: action.tax,
      hasX: action.hasX,
      plan,
      taps: plan?.taps.map((t) => t.source) ?? [],
      lifePaid: plan?.lifePaid ?? 0,
    };
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
      if (!card?.card) continue;
      if (card.controller === this.you) continue;
      if (!(this.view.zones[`bf:${card.controller}`] ?? []).includes(target.id)) continue;
      const oracleCard = this.pool.oracle().byPrinting(card.card.scryfallId);
      if (!oracleCard) continue;
      out.push(faceOf(oracleCard, 0));
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
    const src = { controller: this.you, colors: face?.colors ?? [] };
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
  targetSpecsFor(cardId: InstanceId, abilityIndex?: number): readonly TargetSpec[] {
    const face = this.faceFor(cardId);
    if (!face) return [];
    if (abilityIndex === undefined) return face.targets;
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
       */
      const spellFace = item.instanceId ? this.faceFor(item.instanceId) : null;
      out.push({
        choice: { kind: 'stack', id: item.stackItemId },
        zone: 'stack',
        controller: item.controller,
        kinds: ['spell'],
        types: spellFace?.typeLine.types ?? [],
        manaValue: item.instanceId
          ? (this.pool.oracle().byPrinting(this.view.cards[item.instanceId]?.card?.scryfallId ?? '')?.manaValue ?? null)
          : null,
        power: null,
        toughness: null,
        colors: [],
        keywords: [],
        combat: { attacking: false, blocking: false },
        supertypes: spellFace?.typeLine.supertypes ?? [],
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
