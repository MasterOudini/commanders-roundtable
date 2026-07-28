import { describe, expect, test } from 'vitest';
import { checkInvariants } from './invariants';
import { fromNdjson, replay, stateHash, toNdjson } from './log';
import {
  battlefieldOf,
  findAnywhere,
  idsIn,
  must,
  newTestGame,
  put,
  startedGame,
} from './testing/harness';
import { TREASURE_TOKEN } from '../data/fixtures/engineCards';
import type { GameState } from './types/state';

function zoneOf(state: GameState, id: string): string {
  const card = state.cards[id];
  return card ? `${card.zone.kind}:${card.zone.player ?? '-'}` : '<gone>';
}

describe('zones and the reducer', () => {
  test('a card travels through all seven zones, staying valid at every stop', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = findAnywhere(game, 'p1', 'Serra Angel');
    const route = ['hand', 'battlefield', 'graveyard', 'exile', 'command', 'library', 'hand'] as const;
    for (const to of route) {
      must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: to, player: 'p1' } }));
      expect(zoneOf(game.state, angel), `after moving to ${to}`).toBe(`${to}:p1`);
      expect(checkInvariants(game.state)).toEqual([]);
    }
  });

  /**
   * ⚠️ CR 400.7 — a card that changes zones is a NEW object. Damage, counters,
   * tapped and control all reset. `commanderCastCount` and `isCommander` are the
   * only two exceptions, and forgetting them makes a commander's second cast
   * cost {0}.
   */
  test('leaving the battlefield resets everything except the commander bookkeeping', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = put(game, 'p1', 'Serra Angel');
    must(game.submit({ t: 'ManualSetTapped', player: 'p1', cards: [angel], tapped: true }));
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: angel, kind: '+1/+1', delta: 2 }));
    must(game.submit({ t: 'ManualSetPt', player: 'p1', card: angel, power: 7, toughness: 7 }));
    must(game.submit({ t: 'ManualSetCommander', player: 'p1', card: angel, isCommander: true }));

    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'graveyard', player: 'p1' } }));
    const card = game.state.cards[angel];
    expect(card?.tapped).toBe(false);
    expect(card?.counters).toEqual({});
    expect(card?.damage).toBe(0);
    expect(card?.ptOverride).toBeNull();
    expect(card?.summonedOnTurn).toBeNull();
    expect(card?.isCommander).toBe(true);
  });

  test('an attachment detaches from BOTH sides when its host leaves', () => {
    const game = startedGame({ decks: [['Grizzly Bears', 'Lightning Greaves']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const greaves = put(game, 'p1', 'Lightning Greaves');
    must(game.submit({ t: 'ManualAttach', player: 'p1', card: greaves, to: bear }));
    expect(game.state.cards[greaves]?.attachedTo).toBe(bear);
    expect(game.state.cards[bear]?.attachments).toEqual([greaves]);

    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bear, to: { kind: 'graveyard', player: 'p1' } }));
    expect(game.state.cards[greaves]?.attachedTo).toBeNull();
    expect(game.state.cards[bear]?.attachments).toEqual([]);
    expect(checkInvariants(game.state)).toEqual([]);
  });

  test('an aura with no host falls into the graveyard, but equipment only unattaches', () => {
    const game = startedGame({ decks: [['Grizzly Bears', 'Pacifism', 'Lightning Greaves']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const aura = put(game, 'p1', 'Pacifism');
    const greaves = put(game, 'p1', 'Lightning Greaves');
    must(game.submit({ t: 'ManualAttach', player: 'p1', card: aura, to: bear }));
    must(game.submit({ t: 'ManualAttach', player: 'p1', card: greaves, to: bear }));
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bear, to: { kind: 'graveyard', player: 'p1' } }));
    expect(zoneOf(game.state, aura)).toBe('graveyard:p1');
    expect(zoneOf(game.state, greaves)).toBe('battlefield:p1');
    expect(game.state.cards[greaves]?.attachedTo).toBeNull();
  });

  test('a card placed on the bottom of a library goes to index 0', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = findAnywhere(game, 'p1', 'Serra Angel');
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: angel,
        to: { kind: 'library', player: 'p1' },
        placement: 'bottom',
      }),
    );
    expect(idsIn(game, 'p1', 'library')[0]).toBe(angel);
  });

  test('a token that leaves the battlefield ceases to exist on the next SBA pass', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    must(
      game.submit({
        t: 'ManualCreateToken',
        player: 'p1',
        printingId: TREASURE_TOKEN.scryfallId,
        count: 1,
      }),
    );
    const token = battlefieldOf(game, 'p1').find((id) => game.state.cards[id]?.isToken);
    expect(token).toBeDefined();
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: token as string,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    // It CEASED TO EXIST — it is not in the graveyard, and not in the card map
    // at all. Moving it to exile instead made the SBA see it there next pass
    // and move it again, forever.
    expect(idsIn(game, 'p1', 'graveyard')).not.toContain(token);
    expect(game.state.cards[token as string]).toBeUndefined();
    expect(checkInvariants(game.state)).toEqual([]);
  });

  test('the invariant checker catches a card in two zones', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const broken: GameState = {
      ...game.state,
      zones: { ...game.state.zones, hand: { ...game.state.zones.hand, p1: [...(game.state.zones.hand['p1'] ?? []), bear] } },
    };
    expect(checkInvariants(broken).join(' ')).toContain('is in both');
  });
});

describe('the log replays exactly', () => {
  test('replay(log) reproduces the live state hash', () => {
    const game = startedGame({ decks: [['Serra Angel', 'Sol Ring'], ['Grizzly Bears']], players: 2 });
    put(game, 'p1', 'Serra Angel');
    put(game, 'p1', 'Sol Ring');
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -5 }));
    must(game.submit({ t: 'RollDice', player: 'p1', sides: 20 }));
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });

  test('seq is dense from zero and the log only ever grows', () => {
    const game = startedGame({ players: 2 });
    const lengths: number[] = [game.log.length];
    for (let i = 0; i < 5; i++) {
      must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -1 }));
      lengths.push(game.log.length);
    }
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] as number);
    }
    game.log.forEach((e, i) => expect(e.seq).toBe(i));
  });

  test('an NDJSON round-trip is lossless', () => {
    const game = startedGame({ players: 2 });
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -3 }));
    const text = toNdjson(game.log);
    const parsed = fromNdjson(text);
    expect(parsed.length).toBe(game.log.length);
    expect(stateHash(replay(parsed, game.seed))).toBe(game.hash());
  });

  /**
   * ⚠️ A torn final line is DISCARDED rather than thrown on. The app can be
   * killed mid-write, and the alternative to discarding is a saved game that
   * cannot be opened at all.
   */
  test('a torn final NDJSON line is discarded, not fatal', () => {
    const game = startedGame({ players: 2 });
    const text = toNdjson(game.log);
    const torn = text.slice(0, text.length - 40);
    const parsed = fromNdjson(torn);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.length).toBeLessThan(game.log.length);
  });

  test('the same seed produces the same game and a different seed does not', () => {
    const a = startedGame({ seed: 'alpha', players: 2 });
    const b = startedGame({ seed: 'alpha', players: 2 });
    const c = startedGame({ seed: 'beta', players: 2 });
    expect(a.hash()).toBe(b.hash());
    expect(a.hash()).not.toBe(c.hash());
  });

  test('every rng-consuming event records rngBefore and rngAfter', () => {
    const game = startedGame({ players: 2 });
    must(game.submit({ t: 'RollDice', player: 'p1', sides: 6 }));
    const withRng = game.log.filter((e) => e.rngAfter !== undefined);
    expect(withRng.length).toBeGreaterThan(0);
    for (const e of withRng) expect(e.rngBefore).toBeDefined();
  });
});

describe('setup', () => {
  test('four players are seated in order with 40 life and a commander each', () => {
    const game = startedGame();
    expect(game.state.seating).toEqual(['p1', 'p2', 'p3', 'p4']);
    for (const p of game.state.seating) {
      expect(game.state.players[p]?.life).toBe(40);
      expect(idsIn(game, p, 'command')).toHaveLength(1);
      // 7 in the opening hand, plus turn 1's draw for the active player. With
      // 3+ players NOBODY skips their first draw (CR 103.7a).
      expect(idsIn(game, p, 'hand')).toHaveLength(p === 'p1' ? 8 : 7);
    }
  });

  test('a commander starts in the command zone and is flagged as one', () => {
    const game = startedGame();
    const commander = idsIn(game, 'p1', 'command')[0] as string;
    expect(game.state.cards[commander]?.isCommander).toBe(true);
    expect(game.state.players['p1']?.commanderIds).toEqual([commander]);
  });

  test('the library is the deck minus the opening hand and the turn-1 draw', () => {
    const game = startedGame({ librarySize: 30 });
    expect(idsIn(game, 'p1', 'library')).toHaveLength(22);
    expect(idsIn(game, 'p2', 'library')).toHaveLength(23);
  });

  test('seat identity comes from the commander', () => {
    const game = startedGame();
    // Kess is UBR.
    expect([...(game.state.players['p1']?.identity ?? [])].sort()).toEqual(['B', 'R', 'U']);
  });

  test('the game reaches turn 1 with the starting player active', () => {
    const game = startedGame({ startingPlayer: 'p2' });
    expect(game.state.turn.turnNumber).toBe(1);
    expect(game.state.turn.activePlayer).toBe('p2');
    expect(game.state.gamePhase).toBe('playing');
  });

  test('two different players get different shuffles', () => {
    const game = startedGame();
    const a = idsIn(game, 'p1', 'library').map((id) => game.state.cards[id]?.printingId).join(',');
    const b = idsIn(game, 'p2', 'library').map((id) => game.state.cards[id]?.printingId).join(',');
    expect(a).not.toBe(b);
  });
});

describe('the London mulligan', () => {
  test('keeping seven bottoms nothing', () => {
    const game = newMulliganGame();
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));
    expect(idsIn(game, 'p1', 'hand')).toHaveLength(7);
    expect(game.state.players['p1']?.mulligan.taken).toBe(0);
    expect(game.state.players['p1']?.mulligan.toBottom).toBe(0);
  });

  /**
   * ⚠️ London: you always draw a fresh SEVEN and pay by bottoming later. Drawing
   * six is the old Paris mulligan, and getting it wrong is invisible until
   * somebody counts their opening hand.
   */
  test('one mulligan draws a fresh seven', () => {
    const fresh = newMulliganGame();
    must(fresh.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    expect(fresh.state.zones.hand['p1']).toHaveLength(7);
    expect(fresh.state.players['p1']?.mulligan.taken).toBe(1);
  });

  test('the free first mulligan bottoms nothing', () => {
    const game = newMulliganGame();
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));
    expect(game.state.players['p1']?.mulligan.toBottom).toBe(0);
    expect(game.state.zones.hand['p1']).toHaveLength(7);
  });

  test('with the free mulligan off, the first one costs a card', () => {
    const game = newMulliganGame({ freeFirstMulligan: false });
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));
    expect(game.state.priority.awaiting).toEqual({ kind: 'mulliganBottom', player: 'p1', count: 1 });
  });

  test('three mulligans then keep bottoms two (one was free)', () => {
    const game = newMulliganGame();
    for (let i = 0; i < 3; i++) must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));
    const awaiting = game.state.priority.awaiting;
    expect(awaiting).toEqual({ kind: 'mulliganBottom', player: 'p1', count: 2 });
    const hand = [...(game.state.zones.hand['p1'] ?? [])];
    must(game.submit({ t: 'MulliganBottom', player: 'p1', cards: hand.slice(0, 2) }));
    expect(game.state.zones.hand['p1']).toHaveLength(5);
    expect(game.state.zones.library['p1']?.slice(0, 2)).toEqual(hand.slice(0, 2).reverse());
  });

  test('bottoming the wrong number is refused with a useful message', () => {
    const game = newMulliganGame();
    for (let i = 0; i < 2; i++) must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));
    const hand = [...(game.state.zones.hand['p1'] ?? [])];
    const bad = game.submit({ t: 'MulliganBottom', player: 'p1', cards: hand.slice(0, 2) });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain('exactly 1');
  });

  test('all four players mulligan independently and the game still starts', () => {
    const game = newMulliganGame();
    for (const p of ['p1', 'p2', 'p3', 'p4']) {
      must(game.submit({ t: 'MulliganDecision', player: p, keep: false }));
    }
    for (const p of ['p1', 'p2', 'p3', 'p4']) {
      must(game.submit({ t: 'MulliganDecision', player: p, keep: true }));
    }
    expect(game.state.gamePhase).toBe('playing');
    expect(game.state.turn.turnNumber).toBe(1);
  });

  test('keeping twice is refused', () => {
    const game = newMulliganGame();
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));
    const again = game.submit({ t: 'MulliganDecision', player: 'p1', keep: true });
    expect(again.ok).toBe(false);
  });

  test('a mulligan shuffles the whole library, so the hand is not the same seven', () => {
    const game = newMulliganGame();
    const before = [...(game.state.zones.hand['p1'] ?? [])].join(',');
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    expect([...(game.state.zones.hand['p1'] ?? [])].join(',')).not.toBe(before);
  });

  test('a mulliganed game still replays exactly', () => {
    const game = newMulliganGame();
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));
    const hand = [...(game.state.zones.hand['p1'] ?? [])];
    must(game.submit({ t: 'MulliganBottom', player: 'p1', cards: hand.slice(0, 1) }));
    for (const p of ['p2', 'p3', 'p4']) must(game.submit({ t: 'MulliganDecision', player: p, keep: true }));
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});

/** Deliberately NOT `startedGame`: these tests need the mulligan phase live. */
function newMulliganGame(options?: { freeFirstMulligan?: boolean }) {
  return newTestGame(options ? { options } : {});
}
