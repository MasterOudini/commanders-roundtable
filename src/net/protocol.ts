// The wire protocol. Every byte that leaves this app in a multiplayer game is
// one of the shapes declared here.
//
// ⚠️ THE RELAY READS ONLY `v`, `room` AND `to`. Everything else in an Envelope
// is opaque bytes to it. That is not an implementation detail — it is the whole
// reason the relay can be 200 lines with zero game logic, can be restarted
// mid-game, and can never leak a hand: redaction happens host-side, before
// transmission, so every frame is already addressed to one recipient and
// already stripped. A relay that understood the game would be a second source
// of truth, which is the exact thing that produces "the server and the host
// disagree" bugs with no principled resolution. See spec §7.7.
//
// ⚠️ SEQUENCE NUMBERS EXIST FOR EXACTLY TWO JOBS. WebSocket already guarantees
// ordered delivery over one connection, so `seq`/`ack` are not a reliability
// layer. They are (1) gap detection after a reconnect on a NEW socket, and
// (2) idempotent intents — the host remembers the last `intentId` per player, so
// a client that retries a flaky send cannot double-cast. Do not grow them into
// a retransmit protocol; TCP already did that.
//
// ⚠️ `src/net/` holds the same purity line as `src/engine/` except where a
// transport genuinely needs a socket. This file needs neither a socket nor a
// clock: room-code randomness is INJECTED, so a test can pin it.

import type { CardData } from '../data/cardTypes';
import type { ViewPatch } from '../engine/diffView';
import type { LegalAction } from '../engine/legal';
import type { SolveInput } from '../engine/payment';
import type { InstanceId, OracleId, PlayerId, PrintingId } from '../engine/types/ids';
import type { Intent, RejectReason } from '../engine/types/intents';
import type { Awaiting, GameOptions, Step } from '../engine/types/state';
import type { EngineEvent, PlayerView } from '../view/types';

/**
 * Bumped whenever a shape below changes incompatibly.
 *
 * ⚠️ Compared at TWO places for two different reasons: the relay checks it on
 * `Envelope.v` so it can refuse a frame it cannot route, and the host checks it
 * in `Hello` so it can tell a player *why* their app will not join. The relay
 * check alone is not enough — a relay may be older than both apps.
 */
export const PROTOCOL_VERSION = 1;

/** A relay-assigned connection id. Opaque; only the relay mints them. */
export type ConnId = string;

/** Where a frame goes. `'all'` means every member of the room but the sender. */
export type Address = ConnId | 'host' | 'all';

export interface Envelope {
  readonly v: number;
  readonly room: string;
  readonly from: ConnId;
  readonly to: Address;
  /** Per-sender monotone, from 0. */
  readonly seq: number;
  /** Highest `seq` this sender has seen from its peer. Piggybacked, advisory. */
  readonly ack: number;
  readonly body: ClientToHost | HostToClient | RelayControl;
}

// ── what a player asks the host for ──────────────────────────────────────────

export interface DeckSubmission {
  readonly name: string;
  readonly commanders: readonly { readonly oracleId: OracleId; readonly printingId: PrintingId }[];
  readonly mainDeck: readonly { readonly oracleId: OracleId; readonly printingId: PrintingId }[];
}

export type ClientToHost =
  | {
      readonly t: 'Hello';
      readonly protocol: number;
      readonly appVersion: string;
      readonly playerName: string;
      readonly oracleVersion: string;
      readonly resumeToken?: string;
    }
  | { readonly t: 'SubmitDeck'; readonly deck: DeckSubmission }
  | { readonly t: 'SetReady'; readonly ready: boolean }
  | { readonly t: 'Intent'; readonly intentId: string; readonly intent: Intent }
  | { readonly t: 'RequestResync'; readonly haveEventCount: number; readonly viewHash: string }
  | { readonly t: 'Ping'; readonly nonce: number }
  | { readonly t: 'ChatSend'; readonly text: string };

// ── what the host tells a player ─────────────────────────────────────────────

export interface LobbySeat {
  readonly id: PlayerId;
  readonly name: string;
  readonly seat: number;
  readonly deckName: string | null;
  readonly ready: boolean;
  readonly connected: boolean;
}

export interface LobbyView {
  readonly code: string;
  readonly hostName: string;
  readonly options: GameOptions;
  readonly seats: readonly LobbySeat[];
  /** True once the host has started; a late joiner is told rather than seated. */
  readonly started: boolean;
}

/**
 * A card, as it crosses the wire.
 *
 * ⚠️ `card` is a PRINTING ID, not a `CardData`. The rendered `PlayerView` inlines
 * the whole card object (M2's shape, and it must not change), which is ~2 KB per
 * card: sending it on every tap would make a one-card update 2 KB instead of
 * 120 bytes, and a snapshot ~10× larger. The printing dictionary in `Snapshot`
 * and `Update` carries each `CardData` exactly ONCE per client, and the client
 * rehydrates before anything sees a `PlayerView`. That is also why
 * `oracleVersion` is a hard reject: the dictionary is the only channel by which
 * a client learns a card it does not already have.
 */
export interface WireCardView extends Omit<import('../view/types').CardView, 'card'> {
  readonly card: PrintingId | null;
}

export type WireView = Omit<PlayerView, 'cards'> & {
  readonly cards: Readonly<Record<InstanceId, WireCardView>>;
};

/**
 * A coarse diff of one viewer's `PlayerView`, declared in `src/engine/` because
 * `applyPatch` and `viewHash` live beside `project()` — the three of them have
 * to agree about what a view IS, and splitting them across the engine/net line
 * is how they would stop agreeing.
 *
 * ⚠️ If `patch.base !== client.eventCount` the client asks for a `Snapshot`
 * rather than guessing. Guessing is how a desync becomes permanent.
 */
export type { ViewPatch } from '../engine/diffView';

/**
 * Everything the client's session needs that is NOT in the `PlayerView`.
 *
 * Sent whole rather than diffed: it is a few hundred bytes, and a second diff
 * channel would be a second place for a desync to hide for one twentieth of the
 * saving.
 *
 * ⚠️ `solve` is here so `previewCast` stays SYNCHRONOUS on a guest. `SolveInput`
 * was deliberately decoupled from `GameState` (see `payment.ts`) so the client
 * can run the identical solver on the identical input — which is the only way
 * the plan a player approves is guaranteed to be the plan the host validates.
 */
export interface SessionState {
  readonly eventCount: number;
  readonly awaiting: Awaiting | null;
  readonly priority: PlayerId | null;
  readonly turn: { readonly number: number; readonly active: PlayerId; readonly step: Step };
  readonly finished: boolean;
  readonly winners: readonly PlayerId[];
  readonly legal: readonly LegalAction[];
  readonly solve: SolveInput;
  readonly seats: readonly { readonly id: PlayerId; readonly name: string }[];
  readonly stateHash: string;
}

/** New printings this client has not been sent yet. Usually empty. */
export type PrintingDict = Readonly<Record<PrintingId, CardData>>;

/** One unit of engine work: the patch it produced and the cues it should play. */
export interface UpdateGroup {
  readonly base: number;
  readonly next: number;
  readonly patch: ViewPatch;
  /** Advisory animation cues (D-NET-1). A bug here degrades a beat. */
  readonly narration: readonly EngineEvent[];
}

export type HostToClient =
  | {
      readonly t: 'Welcome';
      readonly you: PlayerId;
      readonly resumeToken: string;
      readonly lobby: LobbyView;
      readonly protocol: number;
      readonly oracleVersion: string;
    }
  | { readonly t: 'LobbyUpdate'; readonly lobby: LobbyView }
  /**
   * The per-line result of a `SubmitDeck`.
   *
   * A spec addition (§7.1 has no such message). Without it an unresolvable deck
   * is either a silent seat or a bare `Error`, and the guest cannot tell WHICH
   * three lines failed — which is exactly the information the M1 importer
   * already computes and the one thing that makes a bad decklist fixable.
   */
  | {
      readonly t: 'DeckReport';
      readonly accepted: boolean;
      readonly deckName: string;
      readonly cardCount: number;
      readonly issues: readonly string[];
    }
  | {
      readonly t: 'Snapshot';
      readonly eventCount: number;
      readonly view: WireView;
      readonly dict: PrintingDict;
      readonly session: SessionState;
      readonly viewHash: string;
    }
  /**
   * Everything one intent produced, for one player, in ONE frame.
   *
   * ⚠️ ONE FRAME PER INTENT, NOT PER GROUP — and that is a bug fix, not a
   * micro-optimisation. A single intent produces ~13.5 groups (one `advance()`
   * each), and the host carries every remote player's traffic over ONE relay
   * socket, so a frame per group per player is ~40 frames per intent on one
   * connection. That runs straight into the relay's 200 msg/s per-connection
   * cap, which drops the excess — and the symptom is one player quietly stuck
   * eleven events behind with no error anywhere. Measured exactly that way.
   *
   * ⚠️ The groups stay SEPARATE inside the frame. Each carries its own patch and
   * its own cues, and the client applies them in order, calling the
   * choreographer once per group. That is the M2 seam: a group's view is
   * committed when that group's animation starts, so collapsing thirteen groups
   * into one patch would commit the final board before the first beat ran.
   */
  | {
      readonly t: 'Update';
      /** Must equal the client's `eventCount`, or it asks for a snapshot. */
      readonly base: number;
      /** The event count after the last group. */
      readonly next: number;
      readonly groups: readonly UpdateGroup[];
      readonly dict: PrintingDict;
      /**
       * ⚠️ Once per FRAME, not once per group. `legalActions` runs the mana
       * solver over every castable card, and its answer is only meaningful where
       * the engine actually stopped; computing it per group would be four solver
       * runs per group for information nobody can act on. The same argument
       * applies to `viewHash`: hashing every group cost two full
       * canonicalisations of the view per group per client — 78% of the host's
       * per-intent time, measured at 38.4 ms for four players.
       */
      readonly session: SessionState;
      readonly viewHash: string;
    }
  | {
      readonly t: 'IntentRejected';
      readonly intentId: string;
      readonly reason: RejectReason;
      readonly message: string;
    }
  | {
      readonly t: 'Presence';
      readonly players: readonly {
        readonly id: PlayerId;
        readonly connected: boolean;
        readonly rttMs: number | null;
      }[];
    }
  | { readonly t: 'ChatPosted'; readonly player: PlayerId; readonly text: string; readonly tHostMs: number }
  | { readonly t: 'Pong'; readonly nonce: number }
  | {
      readonly t: 'Error';
      readonly code: ErrorCode;
      readonly message: string;
    };

export type ErrorCode =
  | 'protocolMismatch'
  | 'roomFull'
  | 'notSeated'
  | 'oracleMismatch'
  | 'gameOver'
  | 'badResumeToken'
  | 'alreadyStarted';

// ── what the relay says ──────────────────────────────────────────────────────

export type RelayErrorCode =
  | 'noSuchRoom'
  | 'roomTaken'
  | 'roomFull'
  | 'rateLimited'
  | 'protocolMismatch'
  | 'badRequest';

export type RelayControl =
  /**
   * `code` asks for a specific room code.
   *
   * ⚠️ This is what makes a relay restart survivable. Without it, a host whose
   * relay went away comes back with a NEW code — and the three people staring at
   * the old one on their screens can never rejoin. The relay grants the request
   * only if the code is free, so it cannot be used to hijack a live room.
   */
  | { readonly t: 'RelayCreateRoom'; readonly code?: string; readonly token?: string }
  | { readonly t: 'RelayRoomCreated'; readonly code: string; readonly connId: ConnId }
  /**
   * `asHost` reclaims the host slot of an existing room, which a host needs
   * after its own socket dies inside the 5-minute grace window. The relay grants
   * it only when the room currently has no host.
   */
  /**
   * `token` is required by the LAN listener and ignored by the internet relay.
   *
   * ⚠️ A six-character room code read aloud is fine on the internet, where an
   * attacker also has to find the relay and guess the code before it expires.
   * On a shared local network — a flat, a hall of residence, a coffee shop —
   * anyone can see the listener, so LAN hosting adds 128 bits that appear only
   * on the host's own screen.
   */
  | { readonly t: 'RelayJoin'; readonly code: string; readonly asHost?: boolean; readonly token?: string }
  | { readonly t: 'RelayJoined'; readonly code: string; readonly connId: ConnId; readonly hostPresent: boolean }
  | { readonly t: 'RelayPeerJoined'; readonly connId: ConnId }
  | { readonly t: 'RelayPeerLeft'; readonly connId: ConnId }
  | { readonly t: 'RelayError'; readonly code: RelayErrorCode; readonly message: string };

export type AnyBody = ClientToHost | HostToClient | RelayControl;

// ── room codes ───────────────────────────────────────────────────────────────

/**
 * ⚠️ No I, O, 0 or 1.
 *
 * The actual use case is one person reading a code aloud over voice chat while
 * three others type it, so the alphabet is chosen for the ear and the eye, not
 * for entropy. 32⁶ ≈ 1.07 × 10⁹ is far more than enough for a handful of
 * simultaneous friend games; ambiguity between O and 0 is not.
 */
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/**
 * A random room code.
 *
 * `rand` is injected: `src/net/` avoids ambient randomness for the same reason
 * `src/engine/` forbids it outright — a test that cannot pin the value has to
 * assert on the shape instead, and shape assertions do not catch a biased
 * generator. `%` over a 32-character alphabet from a 32-bit draw is unbiased
 * because 32 divides 2³².
 */
export function newRoomCode(rand: () => number = randomU32): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_ALPHABET[(rand() >>> 0) % ROOM_ALPHABET.length] ?? 'A';
  }
  return out;
}

/** Case-insensitive: people type room codes in lower case constantly. */
export function normaliseRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isRoomCode(code: string): boolean {
  return ROOM_CODE_RE.test(code);
}

/**
 * Cryptographic randomness where it is available, and a loud failure where it
 * is not — a room code guessable from a clock would let a stranger walk into a
 * friends game, and a silent `Math.random` fallback is exactly how that ships.
 */
export function randomU32(): number {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('randomU32: no WebCrypto in this environment — pass an explicit source.');
  }
  return c.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/** The game seed, generated the same way and for the same reason. */
export function newGameSeed(rand: () => number = randomU32): string {
  return `${(rand() >>> 0).toString(36)}${(rand() >>> 0).toString(36)}`;
}

// ── envelope helpers ─────────────────────────────────────────────────────────

export function envelope(
  room: string,
  from: ConnId,
  to: Address,
  seq: number,
  ack: number,
  body: AnyBody,
): Envelope {
  return { v: PROTOCOL_VERSION, room, from, to, seq, ack, body };
}

/**
 * Is this a frame we can route at all?
 *
 * ⚠️ Checked from `v`, `room` and `to` ALONE, because that is all the relay
 * parses. If this needed `body` the relay would have to understand the game.
 */
export function isRoutable(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Partial<Envelope>;
  return (
    typeof e.v === 'number' &&
    typeof e.room === 'string' &&
    typeof e.from === 'string' &&
    typeof e.to === 'string' &&
    typeof e.seq === 'number' &&
    typeof e.ack === 'number' &&
    typeof e.body === 'object' &&
    e.body !== null
  );
}

export function versionMatches(e: { readonly v: number }): boolean {
  return e.v === PROTOCOL_VERSION;
}
