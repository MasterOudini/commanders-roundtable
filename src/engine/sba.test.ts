// State-based actions that only have something to act on once a permanent
// brings its own counters with it — CR 704.5i (planeswalker at 0 loyalty) and
// 704.5v (battle at 0 defense).
//
// ⚠️ THESE TWO SBAs SHIPPED IN M3 WITH NOTHING TO READ. Nothing ever wrote a
// `loyalty` or `defense` counter, so every planeswalker was binned on the same
// pass it arrived on and every battle with it. Neither starter deck contains
// one, so 1,300 Vitest cases, the 500-seed fuzzer, two full solo games and a
// LAN sign-off were all green through it — the same "a fixture that cannot
// reach a code path is how that path rots" lesson D102 records.

import { describe, expect, test } from 'vitest';
import { checkInvariants } from './invariants';
import { replay, stateHash } from './log';
import { battlefieldOf, findAnywhere, idsIn, must, put, startedGame } from './testing/harness';

const GRIST = 'Grist, the Hunger Tide';
// ⚠️ The FULL card name, both halves. The harness looks a card up by
// `OracleCard.name`, which for a transforming card is `front // back` — the
// battle's own face name resolves in `makeSpec` and then finds nothing on the
// board, which reads as "the fixture is missing" rather than as a name mismatch.
const SIEGE = 'Invasion of Gobakhan // Lightshield Array';

describe('a permanent enters with its printed counters', () => {
  test('a planeswalker enters with its printed loyalty and is still there afterwards', () => {
    const game = startedGame({ decks: [[GRIST]] });
    const grist = put(game, 'p1', GRIST);

    // The whole bug in one assertion: before the fix Grist reached the
    // battlefield with `counters` empty, SBA 4 read 0 loyalty on the very next
    // pump, and `put()` returned an id that was already in the graveyard.
    expect(battlefieldOf(game, 'p1')).toContain(grist);
    expect(idsIn(game, 'p1', 'graveyard')).not.toContain(grist);
    expect(game.state.cards[grist]?.counters['loyalty']).toBe(3);
    expect(checkInvariants(game.state)).toEqual([]);
  });

  test('a battle enters with its printed defense', () => {
    const game = startedGame({ decks: [[SIEGE]] });
    const siege = put(game, 'p1', SIEGE);
    expect(battlefieldOf(game, 'p1')).toContain(siege);
    expect(game.state.cards[siege]?.counters['defense']).toBe(3);
  });

  /**
   * ⚠️ Invariant 5. The counters are a state change, so they arrive as an event
   * on the append-only log — never as a branch inside the reducer's `CardsMoved`
   * case, which is pure in (state, event) alone and could not look the printing
   * up to find the number.
   */
  test('the counters arrive as a logged CountersChanged, after the move', () => {
    const game = startedGame({ decks: [[GRIST]] });
    const grist = put(game, 'p1', GRIST);
    const moveAt = game.log.findIndex(
      (e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === grist && m.to.kind === 'battlefield'),
    );
    const countersAt = game.log.findIndex(
      (e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.card === grist && c.kind === 'loyalty'),
    );
    expect(moveAt).toBeGreaterThanOrEqual(0);
    expect(countersAt).toBeGreaterThan(moveAt);
  });

  /** Counters are part of `GameState`, and so of the state hash. */
  test('a game with a planeswalker in it still replays exactly', () => {
    const game = startedGame({ decks: [[GRIST, SIEGE]] });
    put(game, 'p1', GRIST);
    put(game, 'p1', SIEGE);
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });

  /**
   * The delta is exact only because `clearBattlefieldFields` empties `counters`
   * on every entry. A second trip must give 3, not 6.
   */
  test('leaving and re-entering starts the loyalty over rather than stacking it', () => {
    const game = startedGame({ decks: [[GRIST]] });
    const grist = put(game, 'p1', GRIST);
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: grist, kind: 'loyalty', delta: 4 }));
    expect(game.state.cards[grist]?.counters['loyalty']).toBe(7);

    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: grist, to: { kind: 'hand', player: 'p1' } }));
    expect(game.state.cards[grist]?.counters).toEqual({});
    put(game, 'p1', GRIST);
    expect(game.state.cards[grist]?.counters['loyalty']).toBe(3);
  });

  /**
   * CR 708.2 — a face-down permanent is a 2/2 creature with no name and no
   * types. It is not a planeswalker, so it gets no loyalty, and SBA 4 does not
   * look at it either.
   */
  test('a planeswalker that enters face down gets no loyalty, and survives on its own terms', () => {
    const game = startedGame({ decks: [[GRIST]] });
    const grist = findAnywhere(game, 'p1', GRIST);
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: grist,
        to: { kind: 'battlefield', player: 'p1' },
        faceDown: true,
      }),
    );
    expect(battlefieldOf(game, 'p1')).toContain(grist);
    expect(game.state.cards[grist]?.counters['loyalty']).toBeUndefined();
  });

  /** A card is only a permanent on the battlefield: no counters anywhere else. */
  test('a planeswalker put into a graveyard gets no loyalty counters', () => {
    const game = startedGame({ decks: [[GRIST]] });
    const grist = put(game, 'p1', GRIST, 'graveyard');
    expect(game.state.cards[grist]?.counters).toEqual({});
  });
});

describe('the SBAs those counters exist for still fire', () => {
  test('a planeswalker whose last loyalty counter is removed dies', () => {
    const game = startedGame({ decks: [[GRIST]] });
    const grist = put(game, 'p1', GRIST);
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: grist, kind: 'loyalty', delta: -3 }));
    expect(battlefieldOf(game, 'p1')).not.toContain(grist);
    expect(idsIn(game, 'p1', 'graveyard')).toContain(grist);
  });

  test('a battle whose last defense counter is removed dies', () => {
    const game = startedGame({ decks: [[SIEGE]] });
    const siege = put(game, 'p1', SIEGE);
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: siege, kind: 'defense', delta: -3 }));
    expect(battlefieldOf(game, 'p1')).not.toContain(siege);
    expect(idsIn(game, 'p1', 'graveyard')).toContain(siege);
  });

  test('spending some loyalty leaves the planeswalker alive with the rest', () => {
    const game = startedGame({ decks: [[GRIST]] });
    const grist = put(game, 'p1', GRIST);
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: grist, kind: 'loyalty', delta: -2 }));
    expect(battlefieldOf(game, 'p1')).toContain(grist);
    expect(game.state.cards[grist]?.counters['loyalty']).toBe(1);
  });
});
