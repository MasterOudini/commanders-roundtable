// The game session: the ONE place the engine and the renderer meet.
//
// ⚠️ THE ANTI-CHEATING BOUNDARY. Nothing in `src/ui/` imports `GameState`,
// `src/engine/types/state` or a `HostSession`. The UI reads a `PlayerView` from
// a `ClientSession` and calls `submit()` — and after M4 that is literally true
// for the host's own player too, because it runs through a `loopbackPair` like
// everybody else. "The host cannot see your hand" is now structural rather than
// a matter of discipline.
//
// ⚠️ SOLO PLAY IS FOUR CLIENTS, ONE PER SEAT. That is not a simulation of
// multiplayer — it IS multiplayer, with every socket replaced by a function
// call. The hotseat becomes "look through a different client", which means a
// solo game cannot show you a seat's hand unless you have actually switched to
// being that seat. It also means the solo path and the networked path are one
// code path, so a bug cannot hide in the difference.
//
// ⚠️ EVERY batch goes to `choreographer.ingest(events, viewAfter)` — for the
// ACTIVE viewer only. The M2 seam is unchanged: the engine replaced the fixture
// as the source in M3, and in M4 a socket replaced the function call, and
// nothing in `src/ui/anim/` knows the difference.

import { ClientSession } from '../net/client';
import { HostSession, type DeckResolver, type SeatSpec, type StartSpec } from '../net/host';
import { newGameSeed, newRoomCode, type DeckSubmission, type LobbyView } from '../net/protocol';
import { loopbackPair } from '../net/transport';
import type { Transport } from '../net/transport';
import type { CastPreview } from '../net/client';
import type { LegalAction } from '../engine/legal';
import type { Intent, RejectReason } from '../engine/types/intents';
import type { Awaiting, TargetChoice } from '../engine/types/state';
import type { TargetSpec } from '../engine/types/oracle';
import type { ScriptRegistry } from '../engine/scripts/registry';
import type { CardData } from '../data/cardTypes';
import type { EngineEvent, PlayerView } from '../view/types';
import { emptyView } from '../view/types';
import * as choreographer from '../ui/anim/choreographer';

export type { SeatSpec, StartSpec, CastPreview };

export interface SessionSnapshot {
  readonly running: boolean;
  readonly viewer: string;
  readonly seats: readonly { readonly id: string; readonly name: string }[];
  readonly awaiting: Awaiting | null;
  readonly priority: string | null;
  readonly legal: readonly LegalAction[];
  readonly turn: { readonly number: number; readonly active: string; readonly step: string };
  readonly finished: boolean;
  readonly winners: readonly string[];
  /** The last thing that went wrong, in words. Cleared by the next success. */
  readonly message: string | null;
  /** True while this app is the authority. A guest sees false. */
  readonly hosting: boolean;
  readonly lobby: LobbyView | null;
  readonly connected: boolean;
}

export interface Rejection {
  readonly reason: RejectReason;
  readonly message: string;
}

type Listener = (snapshot: SessionSnapshot) => void;

let host: HostSession | null = null;
/**
 * The seats this app can act for.
 *
 * ⚠️ A guest has exactly ONE, and it is keyed by a placeholder until `Welcome`
 * arrives — a socket cannot tell you your own seat synchronously. `remote` holds
 * it separately so `active()` never has to guess, and so the hotseat can never
 * accidentally reach a seat somebody else is holding.
 */
let clients = new Map<string, ClientSession>();
let remote: ClientSession | null = null;
let order: string[] = [];
let viewer = 'p1';
let listeners: Listener[] = [];
let unsubs: (() => void)[] = [];
let lastReject: Rejection | null = null;
let rejectSeq = 0;
let seatSwitchTimer: ReturnType<typeof setTimeout> | null = null;
let gameId = '';
/**
 * Seats a bot is playing, and the teardown for the runners driving them.
 *
 * ⚠️ Kept HERE rather than on `SeatSpec`, because `SeatSpec` goes to
 * `HostSession` and the host must not know what a bot is. "A bot is a client"
 * (M4 invariant 6) is the one claim the whole design rests on, and a `kind`
 * field on the wire would quietly contradict it — besides being meaningless in
 * a LAN game, where it would have to be redacted or explained.
 */
let botSeats = new Set<string>();
let botTeardown: (() => void) | null = null;

const EMPTY: SessionSnapshot = {
  running: false,
  viewer: 'p1',
  seats: [],
  awaiting: null,
  priority: null,
  legal: [],
  turn: { number: 0, active: 'p1', step: 'untap' },
  finished: false,
  winners: [],
  message: null,
  hosting: false,
  lobby: null,
  connected: false,
};

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}

function notify(): void {
  const snapshot = current();
  for (const fn of [...listeners]) fn(snapshot);
}

function active(): ClientSession | null {
  return remote ?? clients.get(viewer) ?? null;
}

/** Whose eyes the table is seen through. A guest's seat comes from `Welcome`. */
function viewerId(): string {
  return remote ? remote.snapshot().you : viewer;
}

export function current(): SessionSnapshot {
  const client = active();
  if (!client) return EMPTY;
  const s = client.snapshot();
  return {
    running: s.running,
    viewer: viewerId(),
    seats: s.seats,
    awaiting: s.awaiting,
    priority: s.priority,
    legal: s.legal,
    turn: s.turn,
    finished: s.finished,
    winners: s.winners,
    message: s.message,
    hosting: host !== null,
    lobby: s.lobby,
    connected: s.connected,
  };
}

export function view(): PlayerView | null {
  return active()?.currentView() ?? null;
}

export function isRunning(): boolean {
  const client = active();
  return client !== null && client.snapshot().running;
}

export function lastRejection(): Rejection | null {
  return lastReject;
}

export function lobby(): LobbyView | null {
  return active()?.snapshot().lobby ?? null;
}

export function hostSession(): HostSession | null {
  return host;
}

export function currentGameId(): string {
  return gameId;
}

/** The client this app is acting through. Exposed for the probe handles only. */
export function activeClient(): ClientSession | null {
  return active();
}

// ── wiring a client in ───────────────────────────────────────────────────────

/**
 * Attach one `ClientSession` for a seat.
 *
 * ⚠️ Only the ACTIVE viewer's batches reach the choreographer. In a solo game
 * all four clients receive every update — that is what makes switching seats
 * instant — but three of them are bookkeeping. Feeding all four into one
 * choreographer would animate every board at once.
 */
function attach(playerId: string, client: ClientSession): void {
  clients.set(playerId, client);
  if (!order.includes(playerId)) order.push(playerId);
  unsubs.push(
    client.subscribe((snapshot) => {
      if (snapshot.rejectSeq !== rejectSeq && snapshot.message !== null) {
        rejectSeq = snapshot.rejectSeq;
        lastReject = { reason: 'unknownIntent', message: snapshot.message };
      }
      if (remote === client || playerId === viewer) notify();
    }),
  );
}

export interface ClientHooks {
  readonly onBatch: (events: readonly EngineEvent[], view: PlayerView) => void;
  readonly onSnapshot: (view: PlayerView) => void;
  readonly onDesync: (record: { eventCount: number; hostHash: string; clientHash: string }) => void;
}

/** A guest has one client, so it is always the active one. */
function isActiveSeat(playerId: string): boolean {
  return remote !== null || playerId === viewer;
}

/** The callbacks every `ClientSession` this app creates is wired with. */
export function clientHooks(playerId: string): ClientHooks {
  return {
    onBatch: (events, next) => {
      // ⚠️ HOISTED ABOVE THE ACTIVE-SEAT GUARD, and narrowed to the controller's
      // OWN client. Before this the offer was raised from whichever client the
      // table happened to be looking at, so a bot seat — which is never the
      // viewer — could resolve an assisted spell and be offered nothing at all,
      // while the human was offered it instead (D120 fixed WHOSE name went on
      // the button, not whose client raised it). `controller === playerId` also
      // keeps the multiplicity at exactly one in a solo game, where all four
      // clients receive every update.
      for (const e of events) {
        if (e.t === 'StackResolved' && e.instanceId && e.controller === playerId) {
          notifyResolved(e.instanceId, e.targets, e.controller);
        }
      }
      if (!isActiveSeat(playerId)) return;
      choreographer.ingest([...events], next);
    },
    onSnapshot: (next) => {
      if (!isActiveSeat(playerId)) return;
      choreographer.applySnapshot(next);
    },
    onDesync: (record) => {
      // ⚠️ Recorded, not merely repaired. See gamelog.cjs.
      void window.crt?.gameLog
        .desync({ side: 'client', player: playerId, gameId, ...record })
        .catch(() => undefined);
    },
  };
}

// ── starting a local game ────────────────────────────────────────────────────

/**
 * Everything a host needs that only the renderer can supply: the card database
 * behind the deck resolver, and the disk behind the game log.
 */
function bridgeResolver(pool: readonly CardData[]): DeckResolver {
  const byId = new Map(pool.map((c) => [c.scryfallId, c]));
  return {
    async resolve(ids) {
      const out = new Map<string, CardData>();
      const missing: string[] = [];
      for (const id of ids) {
        const local = byId.get(id);
        if (local) out.set(id, local);
        else missing.push(id);
      }
      if (missing.length > 0 && window.crt) {
        for (const card of await window.crt.cardDb.hydrate(missing)) out.set(card.scryfallId, card);
      }
      return out;
    },
  };
}

export interface LocalStart {
  readonly spec: StartSpec;
  readonly oracleVersion: string;
  readonly appVersion: string;
  /**
   * Card scripts, for a caller that has some. **The app never passes this** and
   * `SHIPPED_REGISTRY` is still what ships — see `HostOptions.scripts`, which
   * carries the whole reason this parameter exists.
   */
  readonly scripts?: ScriptRegistry;
}

/**
 * Start a game that lives entirely in this process: one host, one client per
 * seat, every link a `loopbackPair`.
 */
export function startLocal(start: LocalStart): PlayerView {
  stop();
  // ⚠️ UNIQUE PER GAME, not per seed. The log is append-only, so two games that
  // shared an id would share a FILE and the second would be appended to the
  // first — which replays to neither of them. Caught by the net battery, whose
  // fixed probe seed produced a 2,582-line file after several runs and a replay
  // hash that matched nothing.
  gameId = `g-${start.spec.seed}-${newGameSeed()}`;
  host = new HostSession({
    roomCode: newRoomCode(),
    hostName: start.spec.seats[0]?.name ?? 'Host',
    gameId,
    secret: newGameSeed() + newGameSeed(),
    appVersion: start.appVersion,
    oracleVersion: start.oracleVersion,
    seed: start.spec.seed,
    resolver: bridgeResolver(start.spec.pool),
    extraPool: start.spec.pool,
    ...(start.spec.options !== undefined ? { options: start.spec.options } : {}),
    ...(start.scripts !== undefined ? { scripts: start.scripts } : {}),
    onEvents: persistEvents,
    onDesync: (record) => {
      void window.crt?.gameLog.desync({ side: 'host', gameId, ...record }).catch(() => undefined);
    },
  });

  for (const seat of start.spec.seats) {
    const pair: { host: Transport; client: Transport } = loopbackPair(gameId, `local-${seat.id}`);
    host.attach(pair.host);
    const hooks = clientHooks(seat.id);
    const client = new ClientSession(pair.client, {
      playerName: seat.name,
      appVersion: start.appVersion,
      oracleVersion: start.oracleVersion,
      onBatch: hooks.onBatch,
      onSnapshot: hooks.onSnapshot,
      onDesync: hooks.onDesync,
    });
    attach(seat.id, client);
    // The seat's deck is already resolved, so it goes straight in rather than
    // round-tripping through `SubmitDeck` and the card database.
    host.seatDeck(seat.id, `${seat.name}'s deck`, seat.commanders, seat.library);
    client.setReady(true);
  }

  viewer = start.spec.seats[0]?.id ?? 'p1';
  const result = host.start();
  if (!result.ok) {
    stop();
    throw new Error(result.message);
  }
  notify();
  return view() ?? emptyView(viewer);
}

/**
 * Adopt a `HostSession` this app is running over a real transport, plus the
 * local player's own loopback client.
 *
 * ⚠️ The host's own seat is a `loopbackPair` like everybody else's — see
 * `net/transport.ts`. There is no privileged path, which is why the host's UI
 * cannot show a library order even by accident.
 */
export function beginHosting(opts: {
  readonly host: HostSession;
  readonly gameId: string;
  readonly playerId: string;
  readonly client: ClientSession;
}): void {
  host = opts.host;
  gameId = opts.gameId;
  viewer = opts.playerId;
  attach(opts.playerId, opts.client);
  notify();
}

/**
 * Join a game somebody else is hosting. The transport is already connected.
 *
 * ⚠️ ONE client, and its seat is not known yet — `Welcome` has not necessarily
 * arrived. `viewerId()` reads it from the client rather than from a local
 * variable, so nothing has to be re-keyed when it does.
 */
export function beginGuest(client: ClientSession, id: string): void {
  gameId = id;
  remote = client;
  attach('guest', client);
  notify();
}

function persistEvents(events: readonly unknown[]): void {
  if (!window.crt || gameId === '') return;
  void window.crt.gameLog.append(gameId, [...events]).catch(() => undefined);
}

export function stop(): void {
  // ⚠️ BEFORE the clients close. A runner holds a timer against its client, and
  // a timer that fires after `close()` submits into a transport that is gone.
  botTeardown?.();
  botTeardown = null;
  botSeats = new Set();
  for (const off of unsubs) off();
  unsubs = [];
  for (const client of clients.values()) client.close();
  clients = new Map();
  remote = null;
  order = [];
  host?.close();
  host = null;
  gameId = '';
  lastReject = null;
  rejectSeq = 0;
  if (seatSwitchTimer !== null) clearTimeout(seatSwitchTimer);
  seatSwitchTimer = null;
  choreographer.reset();
  void window.crt?.lan.stop().catch(() => undefined);
  notify();
}

// ── acting ───────────────────────────────────────────────────────────────────

/**
 * Send an intent.
 *
 * ⚠️ FIRE AND FORGET, deliberately. Over a loopback the host answers inside this
 * call; over a socket it answers a round trip later. Returning a rejection would
 * therefore be truthful on one side of the wire and always-null on the other,
 * so every caller reads the rejection from the snapshot instead. See the note in
 * `net/client.ts`.
 */
export function submit(intent: Intent): void {
  // ⚠️ ROUTED TO THE SEAT THE INTENT NAMES, not to whoever is being looked at.
  // A hotseat viewer is often one step ahead of the seat that has to act — the
  // mulligan prompt moves to p2 while the table still shows p1 — and sending
  // p2's decision down p1's client is refused by the host with "you can only act
  // for your own seat". That is the host being right: a client speaks for its
  // own seat and no other, which is exactly what protects a real game. The
  // hotseat's job is to pick the right client, and it can only ever pick one
  // this app already holds.
  const owner = 'player' in intent ? intent.player : viewerId();
  const client = remote ?? clients.get(owner) ?? active();
  if (!client) {
    lastReject = { reason: 'gameNotStarted', message: 'No game is running.' };
    notify();
    return;
  }
  lastReject = null;
  client.submit(intent);
  maybeSwitchSeat();
  notify();
}

/**
 * Hotseat: follow the game to whoever it is waiting on.
 *
 * ⚠️ Deferred until the choreographer has drained. A seat change is a HARD SYNC
 * (`applySnapshot` bumps the epoch and discards everything queued), so doing it
 * the instant the engine stops would cut off the animation of the move that just
 * happened — you would never see your own spell resolve.
 */
let autoSwitch = true;

export function setAutoSwitch(on: boolean): void {
  autoSwitch = on;
}

function whoIsNeeded(): string | null {
  const client = active();
  if (!client) return null;
  const s = client.snapshot();
  const awaiting = s.awaiting;
  if (awaiting) {
    switch (awaiting.kind) {
      case 'mulligan':
        return awaiting.players[0] ?? null;
      case 'declareBlockers':
        return awaiting.players.find((p) => !awaiting.submitted.includes(p)) ?? null;
      case 'rewindVote':
        return null;
      default:
        return awaiting.player;
    }
  }
  return s.priority;
}

function maybeSwitchSeat(): void {
  // ⚠️ Only ever within THIS app. A remote game has one client, so `clients`
  // has one entry and the hotseat cannot reach a seat somebody else is holding.
  if (!autoSwitch || clients.size < 2) return;
  // ⚠️ A table with one human and three bots must never arm this at all. Every
  // switch would be suppressed below, and arming it means a 50-iteration
  // choreographer poll on every single submit for a hand-off that cannot happen.
  if (clients.size - botSeats.size < 2) return;
  const needed = whoIsNeeded();
  // ⚠️ THE TABLE NEVER FOLLOWS A BOT. `whoIsNeeded()` returns whoever holds
  // priority, which is routinely the bot, and following it would flip the board
  // to the bot's side every time it responded to anything. `whoIsNeeded` itself
  // is left alone — it is the honest answer to "who is the game waiting on".
  if (!needed || needed === viewer || !clients.has(needed) || botSeats.has(needed)) return;
  if (seatSwitchTimer !== null) clearTimeout(seatSwitchTimer);
  const started = Date.now();
  const poll = (): void => {
    if (clients.size < 2) return;
    const stats = choreographer.stats();
    const settled = stats.queuedGroups === 0 && !stats.running && stats.liveBeats === 0 && stats.inFlight === 0;
    if (settled || Date.now() - started > 4000) {
      seatSwitchTimer = null;
      const target = whoIsNeeded();
      // ⚠️ Guarded AGAIN, because the target is re-read after the drain: a bot
      // can perfectly well become the seat the game is waiting on between the
      // first check and this one.
      if (target && target !== viewer && clients.has(target) && !botSeats.has(target)) {
        // ⚠️ Announced only for a switch the GAME made. Pressing a seat in the
        // picker is already its own answer to "why am I looking at Ben"; a
        // banner over a button the player just pressed is noise, and it is the
        // unannounced hand-off that the player experiences as the table
        // changing sides on its own.
        notifyHandoff(viewer, target);
        setViewer(target);
      }
      return;
    }
    seatSwitchTimer = setTimeout(poll, 80);
  };
  seatSwitchTimer = setTimeout(poll, 80);
}

// ── the hotseat hand-off ─────────────────────────────────────────────────────
//
// ⚠️ A NOTIFICATION, in the same shape as `onSpellResolved` and for the same
// reason: it is a thing that happened, not a thing the game is waiting on. It
// carries seat IDS and no names — `src/ui/` already holds `seats` and is the
// only layer that should be composing a sentence.

export interface SeatHandoff {
  readonly from: string;
  readonly to: string;
}

type HandoffListener = (handoff: SeatHandoff) => void;
let handoffListeners: HandoffListener[] = [];

function notifyHandoff(from: string, to: string): void {
  for (const fn of [...handoffListeners]) fn({ from, to });
}

/** Told whenever the hotseat moves the table to another seat by itself. */
export function onSeatHandoff(fn: HandoffListener): () => void {
  handoffListeners.push(fn);
  return () => {
    handoffListeners = handoffListeners.filter((x) => x !== fn);
  };
}

export function setViewer(player: string): void {
  // ⚠️ A guest cannot change seats. There is exactly one client and it speaks
  // for exactly one player; anything else would be asking the host for someone
  // else's board, which is the request `project()` exists to refuse.
  if (remote) return;
  const client = clients.get(player);
  if (!client) return;
  viewer = player;
  // A hard sync: the new seat's board replaces the old one wholesale, because
  // every queued beat describes a board this player was never looking at.
  choreographer.applySnapshot(client.currentView());
  notify();
}

/** Re-sync the table to the authoritative view. Used by the seat picker and probes. */
export function resync(): void {
  const client = active();
  if (!client) return;
  choreographer.applySnapshot(client.currentView());
  notify();
}

// ── casting helpers the UI needs ─────────────────────────────────────────────

/**
 * What auto-tap WOULD do, without doing it.
 *
 * ⚠️ Synchronous on a guest as well as on the host, because the host ships its
 * `SolveInput` and the client runs the SAME solver on it. A separate preview
 * implementation would drift, and the player would approve one payment and be
 * charged another — the one thing an auto-tapper must never do.
 */
export function previewCast(
  cardId: string,
  xValue = 0,
  targets: readonly TargetChoice[] = [],
): CastPreview | null {
  // ⚠️ `targets` is FORWARDED, and it did not used to be.
  // `ClientSession.previewCast` has computed a ward surcharge from the chosen
  // targets since M5, and this wrapper silently dropped the third argument — so
  // the one cost in this app that depends on what you are pointing at could
  // never reach the player who has to approve it.
  return active()?.previewCast(cardId, xValue, targets) ?? null;
}

// ── the assisted-effect offer ────────────────────────────────────────────────
//
// ⚠️ A CLIENT-SIDE offer, deliberately. A partly-understood card must not block
// the game waiting for an answer — everyone else is mid-turn — so this is a
// notification the prompt bar can show and ignore, not an `Awaiting`.

export interface ResolvedSpell {
  readonly card: string;
  readonly targets: readonly TargetChoice[];
  /**
   * WHOSE spell resolved — never "whoever is looking at the table".
   *
   * ⚠️ This listener fires on the ACTIVE SEAT'S client, which in a hotseat is
   * regularly not the player who cast the thing: the table follows priority
   * (D42), so a spell cast by Ben resolves while Ana is being viewed. Every
   * consumer must act for this player and not for `viewerId()`. See D120.
   */
  readonly controller: string;
}

type ResolvedListener = (spell: ResolvedSpell) => void;
let resolvedListeners: ResolvedListener[] = [];

function notifyResolved(
  card: string,
  targets: readonly { kind: 'card' | 'player' | 'stack'; id: string }[],
  controller: string,
): void {
  const spell: ResolvedSpell = {
    card,
    targets: targets.map((t) => ({ kind: t.kind, id: t.id }) as TargetChoice),
    controller,
  };
  for (const fn of [...resolvedListeners]) fn(spell);
}

/** Told whenever a spell finishes resolving, with what it was aimed at. */
export function onSpellResolved(fn: ResolvedListener): () => void {
  resolvedListeners.push(fn);
  return () => {
    resolvedListeners = resolvedListeners.filter((x) => x !== fn);
  };
}

/**
 * The sentences of a resolved card the app understood, or null when there is
 * nothing to offer — either it did the whole thing itself, or it understood none
 * of it.
 */
export function assistedEffectsFor(cardId: string): { name: string; lines: string[] } | null {
  return active()?.assistedEffectsFor(cardId) ?? null;
}

/** Every object and player that could be pointed at, with its kind. */
export function targetables(): TargetChoice[] {
  return active()?.targetables() ?? [];
}

/** Exactly what this spell or ability may be pointed at, per its parsed clauses. */
export function legalTargetsFor(specs: readonly TargetSpec[], sourceCard: string): TargetChoice[] {
  return active()?.legalTargetsFor(specs, sourceCard) ?? [];
}

/** The parsed target clauses of a card, or of one of its activated abilities. */
export function targetSpecsFor(cardId: string, abilityIndex?: number): readonly TargetSpec[] {
  return active()?.targetSpecsFor(cardId, abilityIndex) ?? [];
}

export function seatIds(): string[] {
  return [...order];
}

/** Seats this app can actually act for — one in a network game, all in solo. */
export function localSeats(): string[] {
  return [...clients.keys()];
}

/** Seats a person is playing: `localSeats()` minus anything a bot is driving. */
export function humanSeats(): string[] {
  return [...clients.keys()].filter((id) => !botSeats.has(id));
}

export function isBotSeat(player: string): boolean {
  return botSeats.has(player);
}

export function botSeatIds(): string[] {
  return [...botSeats];
}

/**
 * Register the seats bots are driving, and how to stop them.
 *
 * ⚠️ Called AFTER `startLocal`, because a runner needs the client it drives.
 */
export function setBotSeats(ids: readonly string[], teardown?: () => void): void {
  botTeardown?.();
  botSeats = new Set(ids);
  botTeardown = teardown ?? null;
}

/**
 * The `ClientSession` for a seat this app holds, so a bot can drive it.
 *
 * ⚠️ `remote` ⇒ null, and that is load-bearing rather than defensive: a guest
 * drives exactly one seat, its own, and returning null here is what makes "no
 * bots over the wire" a property of the code rather than a line in a comment.
 */
export function clientFor(player: string): ClientSession | null {
  return remote ? null : (clients.get(player) ?? null);
}

export function logLength(): number {
  return active()?.snapshot().eventCount ?? 0;
}

export function stateHashNow(): string {
  return active()?.snapshot().stateHash ?? '';
}

/**
 * Propose a group rewind.
 *
 * ⚠️ A VOTE, not a command (D9/Q7). Even in a solo game it goes through the
 * intent — the host re-folds the log only once every living player has agreed,
 * which is what keeps "rewind" the same feature on one machine and on four.
 */
export function rewindTo(eventCount: number): boolean {
  const client = active();
  if (!client) return false;
  const me = client.snapshot().you;
  client.submit({ t: 'ProposeRewind', player: me, toEventCount: eventCount });
  for (const [id, seat] of clients) seat.submit({ t: 'VoteRewind', player: id, agree: true });
  return true;
}

export function eventCount(): number {
  return active()?.snapshot().eventCount ?? 0;
}

/** Submit a deck in a lobby. Only meaningful before the game starts. */
export function submitDeck(deck: DeckSubmission): void {
  active()?.submitDeck(deck);
}

export function setReady(ready: boolean): void {
  active()?.setReady(ready);
}

export function chat(text: string): void {
  active()?.chat(text);
}
