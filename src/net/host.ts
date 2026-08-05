// The host session: the only process in a game that runs the reducer.
//
// ⚠️ D-NET-1 — ONLY THE HOST REDUCES. Clients render a projected view plus
// advisory narration and never run `apply()` on live play. That is why a
// redaction bug degrades an animation instead of desyncing state, and it is why
// the guest's `src/engine/` is present but idle.
//
// ⚠️ THE HOST'S OWN PLAYER IS JUST ANOTHER CLIENT. It joins over a
// `loopbackPair` and holds the same projected `PlayerView` a guest does — see
// `transport.ts`. There is deliberately no privileged path from this class to
// the host's UI.
//
// ⚠️ THE INBOX IS SERIAL, AND SYNCHRONOUS WHEN IT CAN BE. Every handler but
// `SubmitDeck` is synchronous, and an `async` function body runs synchronously
// until its first `await` — so a loopback intent completes inside `send()` and
// the host's own `submit()` still returns after the update it caused. Only a
// deck submission (which has to reach the card database) actually yields, and
// nothing can interleave with it because the queue is serial.
//
// ⚠️ A QUEUE NEEDS SOMEONE TO RESTART IT (D14a, and the choreographer's
// `finally`). `drain()` re-checks for work after clearing `running`; an envelope
// that arrives in the window between the last handler returning and the flag
// dropping would otherwise sit in the inbox forever, which reads as "that
// player stopped responding".

import { diffView, viewHash, type ViewPatch } from '../engine/diffView';
import { Game } from '../engine/game';
import { hashOf } from '../engine/hash';
import { legalActions, legalContext } from '../engine/legal';
import { createOracleDb } from '../engine/oracle';
import { SHIPPED_REGISTRY, type ScriptRegistry } from '../engine/scripts/registry';
import type { SetupPlayer, SetupSpec } from '../engine/setup';
import type { EventBody, GameEvent } from '../engine/types/events';
import type { PlayerId, PrintingId } from '../engine/types/ids';
import type { Intent } from '../engine/types/intents';
import { DEFAULT_OPTIONS, type GameOptions } from '../engine/types/state';
import type { CardData, ColorLetter } from '../data/cardTypes';
import { tokenPrintingIdsIn } from '../data/tokenParse';
import type { PlayerView } from '../view/types';
import {
  envelope,
  PROTOCOL_VERSION,
  type AnyBody,
  type UpdateGroup,
  type ClientToHost,
  type ConnId,
  type DeckSubmission,
  type Envelope,
  type HostToClient,
  type LobbySeat,
  type LobbyView,
  type SessionState,
} from './protocol';
import type { Transport } from './transport';
import { printingsIn, PrintingLedger, toWirePatch, toWireView } from './wire';

export interface SeatSpec {
  readonly id: PlayerId;
  readonly name: string;
  readonly commanders: readonly CardData[];
  readonly library: readonly CardData[];
}

/**
 * A seat's colour identity: the UNION over every commander it sits down with.
 *
 * ⚠️ CR 903.4 — a partner pair's identity is both cards' identities together,
 * which is exactly why the deck validator has always computed it that way when
 * checking the 99. This is the same rule on the other side of the game, and the
 * two used to disagree: the validator would legalise a white-red Ardenn +
 * Rograkh deck and then the engine would play it as whichever commander happened
 * to be first in the list.
 *
 * ⚠️ In WUBRG order, so two seats with the same colours always read the same way
 * — `expandOutputs` hands this list straight to the player as mana buttons.
 */
export function unionIdentity(commanders: readonly CardData[]): ColorLetter[] {
  const seen = new Set<ColorLetter>();
  for (const c of commanders) for (const letter of c.colorIdentity) seen.add(letter);
  return (['W', 'U', 'B', 'R', 'G'] as const).filter((letter) => seen.has(letter));
}

export interface StartSpec {
  readonly seats: readonly SeatSpec[];
  readonly seed: string;
  readonly options?: Partial<GameOptions>;
  /** Every card that could appear, including token printings. */
  readonly pool: readonly CardData[];
}

/** Turns a guest's `{oracleId, printingId}` list into THIS host's card data. */
export interface DeckResolver {
  resolve(ids: readonly PrintingId[]): Promise<Map<PrintingId, CardData>>;
}

export interface DesyncRecord {
  readonly player: PlayerId;
  readonly eventCount: number;
  readonly hostHash: string;
  readonly clientHash: string;
  readonly clientEventCount: number;
}

export interface HostOptions {
  readonly roomCode: string;
  readonly hostName: string;
  readonly gameId: string;
  /** 128 bits of real randomness. Never leaves this process. */
  readonly secret: string;
  readonly appVersion: string;
  readonly oracleVersion: string;
  readonly seed: string;
  readonly resolver: DeckResolver;
  /** Token printings and anything else that can appear without being in a deck. */
  readonly extraPool?: readonly CardData[];
  readonly options?: Partial<GameOptions>;
  /**
   * Card scripts. **Omitted by the app, and `SHIPPED_REGISTRY` is what ships.**
   *
   * ⚠️ NOT a step towards shipping scripts, and deliberately not `options` —
   * a registry is a DEPENDENCY, where `GameOptions` is part of `GameState` and
   * so of the state hash. Landing scripts into the product is M6.4 and carries
   * an accounting obligation this seam does not discharge: the moment a card's
   * script runs, its `tier3.ts` note must go silent and `engineComplete` must
   * accept it, in the same commit (M6.4-LIBRARY-SPEC §6.5, and D122's failure
   * in the other direction).
   *
   * ⚠️ It exists because `optionalTrigger` (D128) is raised only by a registered
   * `TriggerDef`, so with the registry hardcoded there was NO WAY to reach that
   * prompt in a running app at all — its buttons, its intent and its answer path
   * were covered by `tsc -b` and review alone while every other M6.3 prompt was
   * being clicked by a machine (D145). The battery passes a test registry here
   * and clicks it. See D146.
   */
  readonly scripts?: ScriptRegistry;
  readonly maxPlayers?: number;
  readonly now?: () => number;
  /** Append-only persistence. Called with each new slice of history, in order. */
  readonly onEvents?: (events: readonly GameEvent[]) => void;
  readonly onDesync?: (record: DesyncRecord) => void;
  readonly onLobbyChanged?: (lobby: LobbyView) => void;
}

interface Conn {
  readonly id: ConnId;
  readonly transport: Transport;
  player: PlayerId | null;
  seq: number;
  ack: number;
  lastIntentId: string | null;
  readonly ledger: PrintingLedger;
  lastView: PlayerView | null;
  eventCount: number;
  rttMs: number | null;
}

interface Seat {
  readonly id: PlayerId;
  name: string;
  readonly seat: number;
  deckName: string | null;
  commanders: CardData[];
  library: CardData[];
  ready: boolean;
  conn: ConnId | null;
  readonly resumeToken: string;
}

interface Inbound {
  readonly envelope: Envelope;
  readonly transport: Transport;
}

/**
 * A keyed 64-bit tag over `gameId + playerId`.
 *
 * ⚠️ NOT HMAC-SHA256, and spec §7.5 says HMAC. The honest version: what this
 * defends against is two friends clicking "rejoin" at the same moment and one of
 * them landing in the other's seat — and thereby seeing their hand. To take a
 * seat deliberately you would have to guess 64 bits over a socket, with no
 * oracle and no offline attack surface, because `secret` is 128 bits from
 * `crypto.getRandomValues` and never leaves the host. Reaching for
 * `crypto.subtle` would make verification asynchronous and therefore `Hello`
 * asynchronous, for a margin that does not matter under a friends-only trust
 * model in which a cheating HOST is already out of scope.
 */
export function seatToken(secret: string, gameId: string, playerId: PlayerId): string {
  return hashOf({ k: secret, h: hashOf({ k: secret, g: gameId, p: playerId }) });
}

export class HostSession {
  private readonly transports = new Set<Transport>();
  private readonly conns = new Map<ConnId, Conn>();
  private readonly seats: Seat[] = [];
  private readonly pool = new Map<PrintingId, CardData>();
  private readonly inbox: Inbound[] = [];
  private running = false;
  private game: Game | null = null;
  private historyWritten = 0;
  private readonly now: () => number;
  private readonly maxPlayers: number;

  constructor(private readonly opts: HostOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.maxPlayers = opts.maxPlayers ?? 4;
    for (const card of opts.extraPool ?? []) this.pool.set(card.scryfallId, card);
  }

  // ── transports ─────────────────────────────────────────────────────────────

  /**
   * Attach a link. There may be several: one relay socket carrying every remote
   * player, plus one `loopbackPair` per in-process player (of which the host's
   * own seat is always one).
   */
  attach(transport: Transport): void {
    this.transports.add(transport);
    transport.onMessage((envelope) => {
      this.inbox.push({ envelope, transport });
      this.drain();
    });
    transport.onClose(() => {
      this.transports.delete(transport);
      for (const conn of [...this.conns.values()]) {
        if (conn.transport === transport) this.dropConn(conn.id);
      }
    });
  }

  close(): void {
    for (const transport of [...this.transports]) transport.close('host closed');
    this.transports.clear();
    this.conns.clear();
  }

  // ── the serial inbox ───────────────────────────────────────────────────────

  private drain(): void {
    if (this.running) return;
    this.running = true;
    void (async () => {
      try {
        for (;;) {
          const next = this.inbox.shift();
          if (!next) break;
          const pending = this.dispatch(next);
          if (pending) await pending;
        }
      } finally {
        this.running = false;
        // ⚠️ Something has to restart the queue. See the header.
        if (this.inbox.length > 0) this.drain();
      }
    })();
  }

  private dispatch({ envelope: env, transport }: Inbound): void | Promise<void> {
    if (env.v !== PROTOCOL_VERSION) {
      this.sendRaw(transport, env.from, {
        t: 'Error',
        code: 'protocolMismatch',
        message: `That app speaks protocol ${env.v}; this one speaks ${PROTOCOL_VERSION}. Both players need the same version of Commander's Roundtable.`,
      });
      return;
    }
    const body = env.body;
    // Relay bookkeeping. A peer LEAVING is the only part that matters here:
    // joining is learned from the `Hello` that follows it, which is the frame
    // that actually carries a name and a protocol version.
    if (body.t === 'RelayPeerLeft') {
      this.dropConn(body.connId);
      return;
    }
    if (body.t.startsWith('Relay')) return;

    const conn = this.conns.get(env.from);
    if (conn) conn.ack = Math.max(conn.ack, env.seq);
    const client = body as ClientToHost;

    switch (client.t) {
      case 'Hello':
        return this.onHello(env.from, transport, client);
      case 'SubmitDeck':
        return this.onSubmitDeck(env.from, client.deck);
      case 'SetReady':
        return this.onSetReady(env.from, client.ready);
      case 'Intent':
        return this.onIntent(env.from, client.intentId, client.intent);
      case 'RequestResync':
        return this.onResync(env.from, client.haveEventCount, client.viewHash);
      case 'Ping':
        return this.sendTo(env.from, { t: 'Pong', nonce: client.nonce });
      case 'ChatSend':
        return this.onChat(env.from, client.text);
      default:
        return;
    }
  }

  // ── lobby ──────────────────────────────────────────────────────────────────

  private onHello(from: ConnId, transport: Transport, hello: Extract<ClientToHost, { t: 'Hello' }>): void {
    if (hello.protocol !== PROTOCOL_VERSION) {
      this.sendRaw(transport, from, {
        t: 'Error',
        code: 'protocolMismatch',
        message: `${hello.playerName || 'That player'} is running a different version of the app. Both of you need the same one.`,
      });
      return;
    }
    // ⚠️ A HARD REJECT, not a warning (spec Q13). Two players on different
    // Scryfall snapshots can disagree about oracle text, and the disagreement
    // surfaces mid-game as an argument about what a card does that neither
    // player can settle — far worse than being refused at the door.
    if (hello.oracleVersion !== this.opts.oracleVersion) {
      this.sendRaw(transport, from, {
        t: 'Error',
        code: 'oracleMismatch',
        message:
          "Your card database is a different version from the host's. Update the card database on both machines, then join again.",
      });
      return;
    }

    let seat: Seat | undefined;
    if (hello.resumeToken !== undefined && hello.resumeToken !== '') {
      seat = this.seats.find((s) => s.resumeToken === hello.resumeToken);
      if (!seat) {
        this.sendRaw(transport, from, {
          t: 'Error',
          code: 'badResumeToken',
          message: 'That seat could not be reclaimed. Ask the host for the room code and join again.',
        });
        return;
      }
    } else if (this.game) {
      this.sendRaw(transport, from, {
        t: 'Error',
        code: 'alreadyStarted',
        message: 'That game has already started. Only a player who was seated can rejoin.',
      });
      return;
    } else if (this.seats.length >= this.maxPlayers) {
      this.sendRaw(transport, from, {
        t: 'Error',
        code: 'roomFull',
        message: `This game is full (${this.maxPlayers} players).`,
      });
      return;
    } else if (reclaimable(this.seats, this.conns, hello.playerName) !== undefined) {
      // ⚠️ A DISCONNECTED SEAT WITH THE SAME NAME IS RECLAIMED, before the game
      // starts. A guest who closes the app and joins again would otherwise take
      // a NEW seat and leave a ghost behind — one that holds a slot, shows as
      // disconnected forever, and makes `start()` refuse with "Bo is not ready
      // yet" about somebody who is standing right there. Matching on name is
      // safe here and only here: there is no hidden information in a lobby, the
      // trust model is friends-only, and once the game HAS started the
      // `resumeToken` above is the only way in.
      seat = reclaimable(this.seats, this.conns, hello.playerName) as Seat;
    } else {
      const index = this.seats.length;
      const id: PlayerId = `p${index + 1}`;
      seat = {
        id,
        name: hello.playerName || `Player ${index + 1}`,
        seat: index,
        deckName: null,
        commanders: [],
        library: [],
        ready: false,
        conn: null,
        resumeToken: seatToken(this.opts.secret, this.opts.gameId, id),
      };
      this.seats.push(seat);
    }

    // A second socket for the same seat replaces the first: two people clicking
    // rejoin at once must not both end up holding that hand.
    if (seat.conn !== null && seat.conn !== from) this.conns.delete(seat.conn);
    seat.conn = from;
    if (hello.playerName) seat.name = hello.playerName;

    this.conns.set(from, {
      id: from,
      transport,
      player: seat.id,
      seq: 0,
      ack: 0,
      lastIntentId: null,
      ledger: new PrintingLedger(),
      lastView: null,
      eventCount: -1,
      rttMs: null,
    });

    this.sendTo(from, {
      t: 'Welcome',
      you: seat.id,
      resumeToken: seat.resumeToken,
      lobby: this.lobby(),
      protocol: PROTOCOL_VERSION,
      oracleVersion: this.opts.oracleVersion,
    });

    const conn = this.conns.get(from);
    if (this.game && conn) {
      // ⚠️ Board first, presence second. `setPresence` emits an event, which
      // flushes — and a flush to a connection with no board sends a snapshot. Do
      // it the other way round and a rejoining client gets TWO snapshots, the
      // second of which resets the choreographer a frame after the first.
      this.sendSnapshot(conn);
      this.setPresence(seat.id, true);
    }
    this.broadcastLobby();
    this.broadcastPresence();
  }

  private onSubmitDeck(from: ConnId, deck: DeckSubmission): Promise<void> {
    const seat = this.seatOfConn(from);
    if (!seat || this.game) return Promise.resolve();
    const ids = [...new Set([...deck.commanders, ...deck.mainDeck].map((c) => c.printingId))];
    return this.opts.resolver
      .resolve(ids)
      .then(async (found) => {
        const issues: string[] = [];
        const commanders: CardData[] = [];
        const library: CardData[] = [];
        const missing = new Set<PrintingId>();
        for (const entry of deck.commanders) {
          const card = found.get(entry.printingId);
          if (card) commanders.push(card);
          else missing.add(entry.printingId);
        }
        for (const entry of deck.mainDeck) {
          const card = found.get(entry.printingId);
          if (card) library.push(card);
          else missing.add(entry.printingId);
        }
        // ⚠️ Per printing, not "3 cards failed". A guest can only act on this if
        // it names what to change, and the printing id is exactly what their own
        // deck file stores.
        for (const id of missing) {
          issues.push(`Printing ${id} is not in the host's card database — the host may need to update it.`);
        }
        if (commanders.length === 0) issues.push('No commander resolved, so this deck cannot be seated.');
        if (library.length === 0) issues.push('No main-deck card resolved.');

        const accepted = commanders.length > 0 && library.length > 0;
        if (accepted) {
          seat.commanders = commanders;
          seat.library = library;
          seat.deckName = deck.name;
          for (const card of [...commanders, ...library]) this.pool.set(card.scryfallId, card);
          // ⚠️ AWAITED, IN THE SAME CHAIN THAT SEATS THE DECK. A card that
          // creates a token the pool does not hold resolves correctly and puts a
          // BLANK on the battlefield — `derive` cannot find the printing. Doing
          // this after `sendTo` would race `start()`, and a race here is a game
          // that is silently wrong rather than one that fails.
          await this.addTokenPrintings([...commanders, ...library]);
        } else {
          seat.ready = false;
        }
        this.sendTo(from, { t: 'DeckReport', accepted, deckName: deck.name, cardCount: library.length, issues });
        this.broadcastLobby();
      })
      .catch((err: unknown) => {
        this.sendTo(from, {
          t: 'DeckReport',
          accepted: false,
          deckName: deck.name,
          cardCount: 0,
          issues: [`The host could not read its card database: ${String(err)}`],
        });
      });
  }

  private onSetReady(from: ConnId, ready: boolean): void {
    const seat = this.seatOfConn(from);
    if (!seat || this.game) return;
    // Nobody is "ready" without a deck; saying so here is what stops `start()`
    // from being the first place a player learns their deck did not resolve.
    seat.ready = ready && seat.library.length > 0 && seat.commanders.length > 0;
    this.broadcastLobby();
  }

  lobby(): LobbyView {
    const seats: LobbySeat[] = this.seats.map((s) => ({
      id: s.id,
      name: s.name,
      seat: s.seat,
      deckName: s.deckName,
      ready: s.ready,
      connected: s.conn !== null && this.conns.has(s.conn),
    }));
    return {
      code: this.opts.roomCode,
      hostName: this.opts.hostName,
      options: { ...DEFAULT_OPTIONS, ...(this.opts.options ?? {}) },
      seats,
      started: this.game !== null,
    };
  }

  /**
   * Put the token printings these cards can create into the pool.
   *
   * ⚠️ THE POOL IS WHAT THE ORACLE DB IS BUILT FROM (`start()`), so a token
   * printing that is not in it derives to the inert "unknown printing" object —
   * no name, no types, a 0/0 the state-based action bins on the next pass. The
   * spell would have resolved correctly and put a blank on the battlefield.
   *
   * ⚠️ It reuses `DeckResolver`, which already resolves by printing id, rather
   * than growing a second way for the host to reach the card database. Cards
   * already in the pool are not re-fetched, so a four-player table with the same
   * Soldier token in every deck costs one lookup.
   */
  private async addTokenPrintings(cards: readonly CardData[]): Promise<void> {
    const wanted = tokenPrintingIdsIn(cards).filter((id) => !this.pool.has(id));
    if (wanted.length === 0) return;
    try {
      const found = await this.opts.resolver.resolve(wanted);
      for (const card of found.values()) this.pool.set(card.scryfallId, card);
    } catch {
      // A token that cannot be fetched is one card that will not be creatable.
      // Failing the whole deck submission over it would be worse.
    }
  }

  /** Seats with no deck yet — the ones the host UI fills with a starter. */
  seatsWithoutDecks(): PlayerId[] {
    return this.seats.filter((s) => s.library.length === 0).map((s) => s.id);
  }

  /** Give a seat a deck the host built for it (a starter, or the host's own). */
  seatDeck(
    player: PlayerId,
    deckName: string,
    commanders: readonly CardData[],
    library: readonly CardData[],
  ): void {
    const seat = this.seats.find((s) => s.id === player);
    if (!seat) return;
    seat.commanders = [...commanders];
    seat.library = [...library];
    seat.deckName = deckName;
    for (const card of [...commanders, ...library]) this.pool.set(card.scryfallId, card);
    this.broadcastLobby();
  }

  // ── starting ───────────────────────────────────────────────────────────────

  start(): { ok: boolean; message: string } {
    if (this.game) return { ok: false, message: 'This game has already started.' };
    if (this.seats.length < 2) {
      return { ok: false, message: 'A Commander game needs at least two players. Share the room code.' };
    }
    const empty = this.seats.find((s) => s.library.length < 10 || s.commanders.length === 0);
    if (empty) return { ok: false, message: `${empty.name} has no playable deck yet.` };
    const notReady = this.seats.find((s) => !s.ready);
    if (notReady) return { ok: false, message: `${notReady.name} is not ready yet.` };

    const players: SetupPlayer[] = this.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      commanders: seat.commanders.map((c) => ({ oracleId: c.oracleId, printingId: c.scryfallId })),
      library: seat.library.map((c) => ({ oracleId: c.oracleId, printingId: c.scryfallId })),
      // ⚠️ EVERY commander, not the first one. A partner pair is two cards and
      // one colour identity (CR 903.4), so taking `commanders[0]` silently threw
      // away half of an Ardenn + Rograkh deck's colours — and the deck plays as
      // mono-red or mono-white from that moment on. It is not a cosmetic error:
      // `expandOutputs` resolves Command Tower, Arcane Signet and every other
      // "any colour in your commander's identity" source against exactly this
      // list, so a Tower offered one colour instead of two, and a deck whose
      // FIRST commander had no colours at all offered none — which reads as the
      // land being broken rather than as the identity being wrong.
      identity: unionIdentity(seat.commanders),
    }));
    const spec: SetupSpec = {
      gameId: this.opts.gameId,
      seed: this.opts.seed,
      players,
      ...(this.opts.options !== undefined ? { options: this.opts.options } : {}),
    };
    const scripts = this.opts.scripts ?? SHIPPED_REGISTRY;
    this.game = Game.create(spec, { oracle: createOracleDb([...this.pool.values()]), scripts }, {
      // ⚠️ Off in a live game: the invariant sweep is O(cards) per event and the
      // fuzzer already runs it over a million of them. Paying for it here would
      // cost a long frame per commit — exactly what D21 was about.
      checkInvariants: false,
      viewer: this.seats[0]?.id ?? 'p1',
      viewers: this.seats.map((s) => s.id),
    });
    this.game.drain();
    this.persist();

    // Board first, then presence — see the note in `onHello`.
    for (const conn of this.conns.values()) this.sendSnapshot(conn);

    // Anyone who is not here pauses the game the moment it waits on them (Q6).
    const absent: EventBody[] = this.seats
      .filter((s) => s.conn === null || !this.conns.has(s.conn))
      .map((s) => ({ t: 'PresenceChanged', player: s.id, connected: false }));
    if (absent.length > 0) this.applyRules(absent);

    this.broadcastLobby();
    return { ok: true, message: 'Started.' };
  }

  get started(): boolean {
    return this.game !== null;
  }

  /** The authoritative state hash, for the desync log and the dev panel. */
  hash(): string {
    return this.game?.hash() ?? '';
  }

  /** The host's own view of a seat. Used only by tests and the desync log. */
  viewOf(player: PlayerId): PlayerView | null {
    return this.game ? this.game.view(player) : null;
  }

  eventCount(): number {
    return this.game?.state.eventCount ?? 0;
  }

  // ── play ───────────────────────────────────────────────────────────────────

  private onIntent(from: ConnId, intentId: string, intent: Intent): void {
    const conn = this.conns.get(from);
    const game = this.game;
    if (!conn || !conn.player) return;
    if (!game) {
      this.sendTo(from, {
        t: 'IntentRejected',
        intentId,
        reason: 'gameNotStarted',
        message: 'The game has not started yet.',
      });
      return;
    }
    // ⚠️ Idempotence — one of the two jobs `intentId` exists for. A client that
    // retries after a flaky send must not double-cast.
    if (conn.lastIntentId === intentId) return;
    conn.lastIntentId = intentId;

    // A player may only act as themselves. `PassForPlayer` is the deliberate
    // exception, and the engine polices it: it rejects unless the target really
    // is disconnected, and every use is a logged, manual-marked event (Q6).
    if ('player' in intent && intent.player !== conn.player && intent.t !== 'PassForPlayer') {
      this.sendTo(from, {
        t: 'IntentRejected',
        intentId,
        reason: 'noSuchPlayer',
        message: 'You can only act for your own seat.',
      });
      return;
    }

    const result = game.submit(intent);
    if (!result.ok) {
      this.sendTo(from, { t: 'IntentRejected', intentId, reason: result.reason, message: result.message });
      return;
    }
    this.persist();
    this.flush();

    // ⚠️ A unanimous rewind vote does NOT rewind by itself. The engine emits the
    // votes and clears the prompt; re-folding the log is `Game.rewind`, which is
    // deliberately not a reducer case (a reducer that could move BACKWARDS would
    // break the append-only invariant everything rests on). So something above
    // the engine has to notice the vote passed — and this is that something.
    if (intent.t === 'VoteRewind' && intent.agree) this.completeRewindIfAgreed();
  }

  private completeRewindIfAgreed(): void {
    const game = this.game;
    if (!game) return;
    if (game.state.priority.awaiting?.kind === 'rewindVote') return;
    const to = lastRewindProposal(game);
    if (to === null) return;
    if (!game.rewind(to)) return;
    this.persist();
    // Every client's view now describes a board that no longer exists, and a
    // patch cannot express "go backwards". A snapshot is the only honest answer,
    // and it is the same one reconnect uses.
    for (const conn of this.conns.values()) {
      conn.lastView = null;
      this.sendSnapshot(conn);
    }
  }

  /** Push every queued group to every connected player. */
  private flush(): void {
    const game = this.game;
    if (!game) return;
    for (const conn of this.conns.values()) {
      const player = conn.player;
      if (!player) continue;
      const batches = game.drain(player);
      // A connection with no board yet (it just said Hello, or it just resynced)
      // gets the whole thing once, not one snapshot per queued group.
      if (conn.lastView === null) {
        this.sendSnapshot(conn);
        continue;
      }
      if (batches.length === 0) continue;

      const base = conn.eventCount;
      const groups: UpdateGroup[] = [];
      let dict: Record<PrintingId, CardData> = {};
      let last: PlayerView = conn.lastView;
      for (const batch of batches) {
        const patch: ViewPatch = diffView(last, batch.view, conn.eventCount, batch.eventCount);
        Object.assign(dict, conn.ledger.take(printingsIn(batch.view), (id) => this.pool.get(id)));
        groups.push({
          base: patch.base,
          next: patch.next,
          patch: toWirePatch(patch),
          narration: batch.events,
        });
        last = batch.view;
        conn.eventCount = batch.eventCount;
      }
      conn.lastView = last;
      this.sendTo(conn.id, {
        t: 'Update',
        base,
        next: conn.eventCount,
        groups,
        dict,
        session: this.sessionState(player),
        viewHash: viewHash(last),
      });
    }
  }

  private onResync(from: ConnId, haveEventCount: number, clientHash: string): void {
    const conn = this.conns.get(from);
    if (!conn || !conn.player || !this.game) return;
    // ⚠️ RECORDED, not merely repaired. "The board looked wrong once" is not a
    // bug report; `{eventCount, hostHash, clientHash}` is.
    this.opts.onDesync?.({
      player: conn.player,
      eventCount: this.game.state.eventCount,
      hostHash: viewHash(this.game.view(conn.player)),
      clientHash,
      clientEventCount: haveEventCount,
    });
    conn.lastView = null;
    this.sendSnapshot(conn);
  }

  private sendSnapshot(conn: Conn): void {
    const game = this.game;
    const player = conn.player;
    if (!game || !player) return;
    const view = game.view(player);
    // A fresh ledger: this client is being told the whole board, so it needs the
    // whole dictionary for it. Cheaper, and far more obviously correct, than
    // trying to remember what an earlier socket already received.
    conn.ledger.reset();
    const dict = conn.ledger.take(printingsIn(view), (id) => this.pool.get(id));
    this.sendTo(conn.id, {
      t: 'Snapshot',
      eventCount: game.state.eventCount,
      view: toWireView(view),
      dict,
      session: this.sessionState(player),
      viewHash: viewHash(view),
    });
    conn.lastView = view;
    conn.eventCount = game.state.eventCount;
  }

  private sessionState(player: PlayerId): SessionState {
    const game = this.game;
    if (!game) throw new Error('sessionState: no game');
    const state = game.state;
    const ctx = legalContext(state, game.deps.oracle, game.deps.scripts, player);
    return {
      eventCount: state.eventCount,
      awaiting: state.priority.awaiting,
      priority: state.priority.player,
      turn: { number: state.turn.turnNumber, active: state.turn.activePlayer, step: state.turn.step },
      finished: state.gamePhase === 'finished',
      winners: [...state.winners],
      legal: legalActions(state, game.deps.oracle, game.deps.scripts, player, ctx),
      solve: ctx.solve,
      seats: state.seating.map((id) => ({ id, name: state.players[id]?.name ?? id })),
      stateHash: game.hash(),
    };
  }

  private onChat(from: ConnId, text: string): void {
    const seat = this.seatOfConn(from);
    if (!seat) return;
    const clean = text.slice(0, 400);
    if (clean.trim() === '') return;
    this.broadcast({ t: 'ChatPosted', player: seat.id, text: clean, tHostMs: this.now() });
  }

  // ── presence ───────────────────────────────────────────────────────────────

  private dropConn(id: ConnId): void {
    const conn = this.conns.get(id);
    if (!conn) return;
    this.conns.delete(id);
    const seat = this.seats.find((s) => s.conn === id);
    if (seat) {
      seat.conn = null;
      // ⚠️ The game PAUSES if it was waiting on them (spec Q6). `loop.ts` stops
      // advancing while the priority holder is disconnected, and anyone may then
      // use `PassForPlayer` — which the engine refuses for a CONNECTED player, so
      // it cannot be used to steal somebody's turn.
      if (this.game) this.setPresence(seat.id, false);
    }
    this.broadcastLobby();
    this.broadcastPresence();
  }

  private setPresence(player: PlayerId, connected: boolean): void {
    const game = this.game;
    if (!game) return;
    if (game.state.players[player]?.connected === connected) return;
    this.applyRules([{ t: 'PresenceChanged', player, connected }]);
  }

  /** A state change with no intent behind it. Still an event, still logged. */
  private applyRules(events: readonly EventBody[]): void {
    if (!this.game) return;
    this.game.emit(events);
    this.persist();
    this.flush();
  }

  /**
   * Hand every not-yet-written event to the persistence callback.
   *
   * ⚠️ Reads `history`, not `log`. A rewind TRUNCATES the active log while
   * history keeps everything that ever happened plus a `RewoundTo` marker —
   * so slicing `log` would re-emit events after a rewind and produce a file that
   * does not replay.
   */
  private persist(): void {
    const game = this.game;
    if (!game || !this.opts.onEvents) return;
    if (game.history.length <= this.historyWritten) return;
    const next = game.history.slice(this.historyWritten);
    this.historyWritten = game.history.length;
    this.opts.onEvents(next);
  }

  private broadcastPresence(): void {
    this.broadcast({
      t: 'Presence',
      players: this.seats.map((s) => ({
        id: s.id,
        connected: s.conn !== null && this.conns.has(s.conn),
        rttMs: s.conn !== null ? (this.conns.get(s.conn)?.rttMs ?? null) : null,
      })),
    });
  }

  private broadcastLobby(): void {
    const lobby = this.lobby();
    this.opts.onLobbyChanged?.(lobby);
    this.broadcast({ t: 'LobbyUpdate', lobby });
  }

  // ── sending ────────────────────────────────────────────────────────────────

  private seatOfConn(id: ConnId): Seat | undefined {
    const conn = this.conns.get(id);
    if (!conn || !conn.player) return undefined;
    return this.seats.find((s) => s.id === conn.player);
  }

  private sendTo(to: ConnId, body: HostToClient): void {
    const conn = this.conns.get(to);
    if (!conn) return;
    this.sendRaw(conn.transport, to, body);
  }

  /**
   * ⚠️ One DIRECTED frame per connection rather than a single `to: 'all'`.
   *
   * `seq` is per-sender-per-recipient and monotone, which is what makes a gap
   * detectable after a reconnect on a new socket; a shared broadcast frame
   * cannot carry a different `seq` for each recipient, so allowing one would
   * quietly break the only thing `seq` is for. A room holds at most four
   * players, so "four small frames" costs nothing worth having.
   */
  private broadcast(body: HostToClient): void {
    for (const conn of [...this.conns.values()]) this.sendRaw(conn.transport, conn.id, body);
  }

  private sendRaw(transport: Transport, to: ConnId, body: AnyBody): void {
    const conn = this.conns.get(to);
    const seq = conn ? conn.seq++ : 0;
    const ack = conn ? conn.ack : 0;
    transport.send(envelope(this.opts.roomCode, 'host', to, seq, ack, body));
  }
}

/** A pre-game seat with this name whose socket has gone away, if there is one. */
function reclaimable(
  seats: readonly Seat[],
  conns: ReadonlyMap<ConnId, Conn>,
  name: string,
): Seat | undefined {
  if (name === '') return undefined;
  return seats.find((s) => s.name === name && (s.conn === null || !conns.has(s.conn)));
}

/** The rewind point the pod is voting on, or null if there is no live proposal. */
function lastRewindProposal(game: Game): number | null {
  for (let i = game.history.length - 1; i >= 0; i--) {
    const body = game.history[i]?.body;
    if (!body) continue;
    if (body.t === 'RewindProposed') return body.toEventCount;
    if (body.t === 'RewindCancelled' || body.t === 'RewoundTo') return null;
  }
  return null;
}
