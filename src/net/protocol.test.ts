import { describe, expect, test } from 'vitest';
import {
  envelope,
  isRoomCode,
  isRoutable,
  newGameSeed,
  newRoomCode,
  normaliseRoomCode,
  PROTOCOL_VERSION,
  ROOM_ALPHABET,
  ROOM_CODE_LENGTH,
  versionMatches,
  type AnyBody,
  type Envelope,
} from './protocol';
import { DEFAULT_OPTIONS } from '../engine/types/state';
import { EMPTY_POOL } from '../engine/types/mana';

// A counter dressed as a random source: `newRoomCode` takes its randomness as a
// parameter precisely so a test can pin it (see the file header).
function counterRand(start = 0): () => number {
  let n = start;
  return () => n++;
}

describe('room codes', () => {
  test('is six characters from the unambiguous alphabet', () => {
    const code = newRoomCode(counterRand(7));
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const ch of code) expect(ROOM_ALPHABET).toContain(ch);
    expect(isRoomCode(code)).toBe(true);
  });

  test('never contains I, O, 0 or 1 — the four characters people mis-hear', () => {
    // Sweep the whole alphabet index space rather than sampling: the point is
    // that NO draw can produce one of these, not that this draw did not.
    for (let i = 0; i < 4096; i++) {
      const code = newRoomCode(counterRand(i));
      expect(code).not.toMatch(/[IO01]/);
    }
    expect(ROOM_ALPHABET).not.toMatch(/[IO01]/);
    expect(ROOM_ALPHABET).toHaveLength(32);
  });

  test('the mapping is unbiased — 32 divides 2^32, so every letter is equally likely', () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < ROOM_ALPHABET.length; i++) {
      const ch = newRoomCode(counterRand(i))[0] ?? '';
      seen.set(ch, (seen.get(ch) ?? 0) + 1);
    }
    expect(seen.size).toBe(ROOM_ALPHABET.length);
  });

  test('accepts a code typed in lower case with spaces or dashes', () => {
    expect(normaliseRoomCode(' k7m-2qx ')).toBe('K7M2QX');
    expect(isRoomCode(normaliseRoomCode('k7m2qx'))).toBe(true);
  });

  test('rejects a code with an ambiguous character or the wrong length', () => {
    expect(isRoomCode('K7M2Q')).toBe(false);
    expect(isRoomCode('K7M2QXX')).toBe(false);
    expect(isRoomCode('K7M2QO')).toBe(false);
    expect(isRoomCode('K7M2Q1')).toBe(false);
    expect(isRoomCode('')).toBe(false);
  });

  test('a game seed is a string and varies with the source', () => {
    expect(newGameSeed(counterRand(1))).not.toBe(newGameSeed(counterRand(99)));
    expect(typeof newGameSeed(counterRand(1))).toBe('string');
  });
});

// One representative value per message kind. The point of the round trip is not
// that JSON works — it is that no shape here smuggles a Map, a Set, a Date or an
// `undefined`, any of which survives a local test and vanishes on the wire.
const BODIES: AnyBody[] = [
  { t: 'Hello', protocol: PROTOCOL_VERSION, appVersion: '0.4.0', playerName: 'Ada', oracleVersion: 'or-1' },
  {
    t: 'Hello',
    protocol: PROTOCOL_VERSION,
    appVersion: '0.4.0',
    playerName: 'Ada',
    oracleVersion: 'or-1',
    resumeToken: 'tok',
  },
  { t: 'SubmitDeck', deck: { name: 'Kess', commanders: [{ oracleId: 'o1', printingId: 'p1' }], mainDeck: [] } },
  { t: 'SetReady', ready: true },
  { t: 'Intent', intentId: 'i-1', intent: { t: 'PassPriority', player: 'p1' } },
  { t: 'RequestResync', haveEventCount: 12, viewHash: 'abc' },
  { t: 'Ping', nonce: 4 },
  { t: 'ChatSend', text: 'gg' },

  {
    t: 'Welcome',
    you: 'p2',
    resumeToken: 'tok',
    protocol: PROTOCOL_VERSION,
    oracleVersion: 'or-1',
    lobby: { code: 'K7M2QX', hostName: 'Ada', options: DEFAULT_OPTIONS, seats: [], started: false },
  },
  {
    t: 'LobbyUpdate',
    lobby: {
      code: 'K7M2QX',
      hostName: 'Ada',
      options: DEFAULT_OPTIONS,
      seats: [{ id: 'p1', name: 'Ada', seat: 0, deckName: 'Kess', ready: true, connected: true }],
      started: false,
    },
  },
  { t: 'DeckReport', accepted: false, deckName: 'Kess', cardCount: 97, issues: ['Line 4: no card named "Sol Rng".'] },
  {
    t: 'Snapshot',
    eventCount: 3,
    view: {
      me: 'p1',
      seatOrder: ['p1'],
      seats: {},
      cards: {},
      zones: {},
      stack: [],
      turn: { active: 'p1', phase: 'main1', turnNumber: 1 },
      priority: 'p1',
      log: [],
      hiddenCounts: {},
      peek: [],
    },
    dict: {},
    session: {
      eventCount: 3,
      awaiting: null,
      priority: 'p1',
      turn: { number: 1, active: 'p1', step: 'precombatMain' },
      finished: false,
      winners: [],
      legal: [{ t: 'PassPriority' }],
      solve: { pool: EMPTY_POOL, sources: [], lifeAvailable: 40, eventCount: 3 },
      seats: [{ id: 'p1', name: 'Ada' }],
      stateHash: 'h',
    },
    viewHash: 'vh',
  },
  {
    t: 'Update',
    base: 3,
    next: 5,
    groups: [
      {
        base: 3,
        next: 5,
        patch: { base: 3, next: 5, set: { priority: 'p2' }, del: ['cards.c9'] },
        narration: [{ t: 'PriorityChanged', stepId: 4, player: 'p2' }],
      },
    ],
    dict: {},
    session: {
      eventCount: 5,
      awaiting: null,
      priority: 'p2',
      turn: { number: 1, active: 'p1', step: 'precombatMain' },
      finished: false,
      winners: [],
      legal: [],
      solve: { pool: EMPTY_POOL, sources: [], lifeAvailable: 40, eventCount: 5 },
      seats: [],
      stateHash: 'h',
    },
    viewHash: 'vh2',
  },
  { t: 'IntentRejected', intentId: 'i-1', reason: 'notYourPriority', message: 'It is not your turn to act.' },
  { t: 'Presence', players: [{ id: 'p1', connected: true, rttMs: 12 }, { id: 'p2', connected: false, rttMs: null }] },
  { t: 'ChatPosted', player: 'p1', text: 'gg', tHostMs: 1000 },
  { t: 'Pong', nonce: 4 },
  { t: 'Error', code: 'oracleMismatch', message: 'Your card database is a different version.' },

  { t: 'RelayCreateRoom' },
  { t: 'RelayRoomCreated', code: 'K7M2QX', connId: 'c0' },
  { t: 'RelayJoin', code: 'K7M2QX' },
  { t: 'RelayJoined', code: 'K7M2QX', connId: 'c1', hostPresent: true },
  { t: 'RelayPeerJoined', connId: 'c1' },
  { t: 'RelayPeerLeft', connId: 'c1' },
  { t: 'RelayError', code: 'noSuchRoom', message: 'No room with that code.' },
];

describe('envelopes', () => {
  test('every message kind survives a JSON round trip unchanged', () => {
    const kinds = new Set<string>();
    for (const body of BODIES) {
      kinds.add(body.t);
      const sent = envelope('K7M2QX', 'c1', 'host', 1, 0, body);
      const back = JSON.parse(JSON.stringify(sent)) as Envelope;
      expect(back).toEqual(sent);
      expect(isRoutable(back)).toBe(true);
      expect(versionMatches(back)).toBe(true);
    }
    // 7 ClientToHost + 10 HostToClient + 7 RelayControl.
    expect(kinds.size).toBe(24);
  });

  test('a version mismatch is decidable from the envelope alone', () => {
    // ⚠️ The relay must be able to refuse a frame WITHOUT parsing `body`, which
    // is the property that lets it stay ignorant of the game.
    const stranger = { v: 99, room: 'K7M2QX', from: 'c1', to: 'host', seq: 0, ack: 0, body: { t: 'Nope' } };
    expect(isRoutable(stranger)).toBe(true);
    expect(versionMatches(stranger)).toBe(false);
  });

  test('a frame missing a routing field is not routable', () => {
    expect(isRoutable(null)).toBe(false);
    expect(isRoutable('{}')).toBe(false);
    expect(isRoutable({ v: 1, room: 'K7M2QX', from: 'c1', seq: 0, ack: 0, body: {} })).toBe(false);
    expect(isRoutable({ v: 1, room: 'K7M2QX', from: 'c1', to: 'host', seq: 0, ack: 0 })).toBe(false);
    expect(isRoutable({ v: 1, room: 'K7M2QX', from: 'c1', to: 'host', seq: 0, ack: 0, body: null })).toBe(false);
  });

  test('an envelope carries the current protocol version by construction', () => {
    expect(envelope('K7M2QX', 'c0', 'all', 0, 0, { t: 'Ping', nonce: 1 }).v).toBe(PROTOCOL_VERSION);
  });
});
