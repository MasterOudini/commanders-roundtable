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
import { advanceUntil, battlefieldOf, findAnywhere, holdEverywhere, idsIn, must, put, startedGame } from './testing/harness';

const GRIST = 'Grist, the Hunger Tide';
// ⚠️ The FULL card name, both halves. The harness looks a card up by
// `OracleCard.name`, which for a transforming card is `front // back` — the
// battle's own face name resolves in `makeSpec` and then finds nothing on the
// board, which reads as "the fixture is missing" rather than as a name mismatch.
const SIEGE = 'Invasion of Gobakhan // Lightshield Array';
// D108 — the permanents that BECOME a planeswalker rather than arriving as one.
const JACE = "Jace, Vryn's Prodigy // Jace, Telepath Unbound"; // creature → PW 5
const ARLINN = 'Arlinn Kord // Arlinn, Embraced by the Moon'; // PW 3 → PW, no printed loyalty
const INVASION = 'Invasion of New Phyrexia // Teferi Akosa of Zhalfir'; // battle 6 → PW 4

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

/**
 * D108 — the same rule reached by transforming instead of by entering. All 14
 * Commander-legal cards whose back face is a planeswalker go through the Tier-3
 * Transform button, and before this they flipped onto an empty counter map and
 * SBA 4 binned them on the same pump — D107's bug, one step along.
 */
describe('a permanent that BECOMES a planeswalker', () => {
  const flip = (game: ReturnType<typeof startedGame>, card: string) =>
    must(game.submit({ t: 'ManualFlipFace', player: 'p1', card }));

  test('gets the printed loyalty of the face it is now showing, and survives', () => {
    const game = startedGame({ decks: [[JACE]] });
    const jace = put(game, 'p1', JACE);
    // The front face is a creature, so nothing is owed on the way in.
    expect(game.state.cards[jace]?.counters['loyalty']).toBeUndefined();

    flip(game, jace);
    // The whole bug in one assertion: before this rule the flip left the counter
    // map empty, SBA 4 read 0 loyalty on the next pump, and Jace was in the
    // graveyard before anyone could use him.
    expect(battlefieldOf(game, 'p1')).toContain(jace);
    expect(idsIn(game, 'p1', 'graveyard')).not.toContain(jace);
    expect(game.state.cards[jace]?.counters['loyalty']).toBe(5);
    expect(checkInvariants(game.state)).toEqual([]);
  });

  /**
   * ⚠️ Invariant 5, and the adjacency the fuzz gate's transform canary counts
   * on: the funnel returns `[FaceIndexSet, CountersChanged]` and `applyBatch`
   * appends them in that order, so the counters land in the very next slot.
   */
  test('the loyalty arrives as a logged CountersChanged in the slot after the flip', () => {
    const game = startedGame({ decks: [[JACE]] });
    const jace = put(game, 'p1', JACE);
    flip(game, jace);
    const flipAt = game.log.findIndex((e) => e.body.t === 'FaceIndexSet' && e.body.card === jace);
    const countersAt = game.log.findIndex(
      (e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.card === jace && c.kind === 'loyalty'),
    );
    expect(flipAt).toBeGreaterThanOrEqual(0);
    expect(countersAt).toBe(flipAt + 1);
  });

  /**
   * ⚠️ THE REASON THIS IS SET-TO-N AND NOT ADD-N. `CountersChanged` is a delta
   * and the Transform button toggles, so `+5` per flip would leave this Jace on
   * 8 — and on 13 after another round trip.
   */
  test('flipping away and back sets the loyalty rather than stacking it', () => {
    const game = startedGame({ decks: [[JACE]] });
    const jace = put(game, 'p1', JACE);
    flip(game, jace);
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: jace, kind: 'loyalty', delta: -2 }));
    expect(game.state.cards[jace]?.counters['loyalty']).toBe(3);

    // Back to the creature face. CR 701.28 turns the card over and does nothing
    // to what is sitting on it, so the spent loyalty stays put — and inert,
    // because SBA 4 only looks at planeswalkers.
    flip(game, jace);
    expect(game.state.cards[jace]?.counters['loyalty']).toBe(3);
    expect(battlefieldOf(game, 'p1')).toContain(jace);

    flip(game, jace);
    expect(game.state.cards[jace]?.counters['loyalty']).toBe(5);
  });

  /**
   * ⚠️ The trigger is the TRANSITION. Arlinn is a planeswalker on both faces, so
   * she never *becomes* one and never gets a fresh set — flipping her is not a
   * way to heal her. Her back face is also one of the only two planeswalker
   * faces in the database with no printed loyalty at all, so this is the null
   * guard too: a delta computed against `null` as 0 would strip her instead.
   */
  test('a planeswalker that was already one keeps its loyalty across both flips', () => {
    const game = startedGame({ decks: [[ARLINN]] });
    const arlinn = put(game, 'p1', ARLINN);
    expect(game.state.cards[arlinn]?.counters['loyalty']).toBe(3);
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: arlinn, kind: 'loyalty', delta: -2 }));
    expect(game.state.cards[arlinn]?.counters['loyalty']).toBe(1);

    flip(game, arlinn); // → the face with no printed loyalty
    expect(game.state.cards[arlinn]?.counters['loyalty']).toBe(1);
    expect(battlefieldOf(game, 'p1')).toContain(arlinn);

    flip(game, arlinn); // → back to the face printed 3
    expect(game.state.cards[arlinn]?.counters['loyalty']).toBe(1);
    expect(battlefieldOf(game, 'p1')).toContain(arlinn);
  });

  /**
   * The only one of the 14 whose front face already carries counters. Its
   * defense stays exactly where it is — counters of another kind are not this
   * rule's business — and goes inert, because SBA 4 stops reading `defense` the
   * moment the permanent stops being a battle.
   */
  test('a battle that becomes a planeswalker keeps its defense and gains loyalty', () => {
    const game = startedGame({ decks: [[INVASION]] });
    const invasion = put(game, 'p1', INVASION);
    expect(game.state.cards[invasion]?.counters['defense']).toBe(6);
    expect(game.state.cards[invasion]?.counters['loyalty']).toBeUndefined();

    flip(game, invasion);
    expect(battlefieldOf(game, 'p1')).toContain(invasion);
    expect(game.state.cards[invasion]?.counters).toEqual({ defense: 6, loyalty: 4 });
  });

  /** A card is only a permanent on the battlefield. */
  test('flipping a card over in a hand adds nothing', () => {
    const game = startedGame({ decks: [[JACE]] });
    const jace = put(game, 'p1', JACE, 'hand');
    flip(game, jace);
    expect(game.state.cards[jace]?.counters).toEqual({});
  });

  /** CR 708.2 — a face-down permanent is a typeless 2/2, whatever is underneath. */
  test('flipping a face-down permanent adds nothing', () => {
    const game = startedGame({ decks: [[JACE]] });
    const jace = findAnywhere(game, 'p1', JACE);
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: jace,
        to: { kind: 'battlefield', player: 'p1' },
        faceDown: true,
      }),
    );
    flip(game, jace);
    expect(battlefieldOf(game, 'p1')).toContain(jace);
    expect(game.state.cards[jace]?.counters).toEqual({});
  });

  /** A two-faced card with no planeswalker anywhere on it is left alone. */
  test('flipping a creature into another creature adds nothing', () => {
    const game = startedGame({ decks: [['Delver of Secrets // Insectile Aberration']] });
    const delver = put(game, 'p1', 'Delver of Secrets // Insectile Aberration');
    flip(game, delver);
    expect(game.state.cards[delver]?.counters).toEqual({});
    expect(battlefieldOf(game, 'p1')).toContain(delver);
  });

  /** Counters are part of `GameState`, and so of the state hash. */
  test('a game with a transform in it still replays exactly', () => {
    const game = startedGame({ decks: [[JACE, ARLINN, INVASION]] });
    const jace = put(game, 'p1', JACE);
    flip(game, jace);
    const arlinn = put(game, 'p1', ARLINN);
    flip(game, arlinn);
    const invasion = put(game, 'p1', INVASION);
    flip(game, invasion);
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});

// ── the world rule (CR 704.5m) ───────────────────────────────────────────────
//
// ⚠️ A Tier-1 gap found by D129 while choosing a layer-6 demonstration card, and
// left open until D147: `sba.ts` never mentioned the supertype, so any number of
// world permanents could sit on the battlefield at once. `Gravity Sphere` is the
// only world permanent in these fixtures — it is there for the CR 613.7
// timestamp pair — and it is why the gap was noticed at all.
describe('the world rule', () => {
  const WORLD = 'Gravity Sphere';

  test('two world permanents: the NEWEST survives, with nobody asked', () => {
    const game = startedGame({ players: 2, decks: [[WORLD, WORLD]] });
    holdEverywhere(game);
    const first = put(game, 'p1', WORLD);
    const second = put(game, 'p1', WORLD);
    advanceUntil(game, (s) => s.zones.battlefield.length <= 1, 20_000);

    expect(game.state.cards[first]?.zone.kind).toBe('graveyard');
    expect(game.state.cards[second]?.zone.kind).toBe('battlefield');
    // ⚠️ NO PROMPT. This is the whole difference from the legend rule: the
    // answer is determined, so asking would be a question with one legal reply.
    expect(game.state.priority.awaiting?.kind).not.toBe('legendChoice');
  });

  test('it is GLOBAL — two players cannot keep one each', () => {
    const game = startedGame({ players: 2, decks: [[WORLD], [WORLD]] });
    holdEverywhere(game);
    const mine = put(game, 'p1', WORLD);
    const theirs = put(game, 'p2', WORLD);
    advanceUntil(game, (s) => s.zones.battlefield.length <= 1, 20_000);

    // The legend rule groups by controller; this one does not.
    expect(game.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(game.state.cards[theirs]?.zone.kind).toBe('battlefield');
  });

  test('one on its own is left alone', () => {
    const game = startedGame({ players: 2, decks: [[WORLD]] });
    holdEverywhere(game);
    const only = put(game, 'p1', WORLD);
    advanceUntil(game, (s) => s.priority.awaiting !== null || s.stack.length === 0, 20_000);
    expect(game.state.cards[only]?.zone.kind).toBe('battlefield');
  });

  test('it goes to its OWNER\u2019s graveyard, not its controller\u2019s', () => {
    const game = startedGame({ players: 2, decks: [[WORLD], [WORLD]] });
    holdEverywhere(game);
    const theirs = put(game, 'p2', WORLD);
    // p1 steals it, then plays their own — so the stolen one is the older.
    must(game.submit({ t: 'ManualSetController', player: 'p1', card: theirs, controller: 'p1' }));
    put(game, 'p1', WORLD);
    advanceUntil(game, (s) => s.zones.battlefield.length <= 1, 20_000);
    expect(game.state.cards[theirs]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
  });
});
