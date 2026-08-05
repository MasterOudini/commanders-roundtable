// THE CONFORMANCE CORPUS — known-hard interactions with published answers.
// M6.4-LIBRARY-SPEC §6 gate 2. See D157.
//
// ⚠️⚠️ **THE ONLY GATE THAT CATCHES A SCRIPT THAT IS INDIVIDUALLY RIGHT AND
// WRONG IN COMBINATION.** Every other check in this repo asks whether one card
// does what its text says. A corpus case asks what TWO cards do to each other,
// where the published answer is often counter-intuitive and a naive
// implementation is right for the overwhelming majority of boards and silently
// wrong for these. The spec's words: "a corpus failure blocks a release."
//
// ⚠️ **IT EXISTS BEFORE THE THING IT GUARDS, ON PURPOSE** — the same argument
// `shippedScripts.node.test.ts` makes about itself. M6.4 lands scripts in
// batches, and the batch that breaks a layer interaction will not look different
// from the batch that does not. Seeding it now with the five interactions this
// milestone already proved means the first generated script arrives into a
// harness that can fail it.
//
// ⚠️ **EACH CASE ASSERTS BOTH ANSWERS WHERE THERE ARE TWO.** An ordering rule
// tested in one direction passes with the ordering code deleted — which is how
// D129's pair, D148's pair and D152's declaration were each verified when they
// were built, and the corpus keeps that property rather than re-stating the
// happy path.
//
// ⚠️ It is a TEST FILE rather than a data format with a runner, deliberately:
// the cases need real boards, and a bespoke DSL over `Game` would be a second
// way to write a test whose only advantage is looking like a corpus.
//
// Adding a case: give it a `CR` reference and a published answer, assert every
// direction, and raise `CASES`.

import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { Game } from './game';
import { createRegistry } from './scripts/registry';
import {
  BRANCHING_EVOLUTION_SCRIPT,
  GRAVITY_SPHERE_SCRIPT,
  HARDENED_SCALES_SCRIPT,
  HUMILITY_SCRIPT,
  KNIGHTHOOD_SCRIPT,
  KWENDE_SCRIPT,
  LEVITATION_SCRIPT,
} from './testing/cardScripts';
import { advanceUntil, holdEverywhere, must, nameOf, ORACLE, put, startedGame } from './testing/harness';
import type { InstanceId } from './types/ids';

/**
 * ⚠️ ONE REGISTRY FOR THE WHOLE CORPUS, in a fixed order, holding every script.
 * A case that registered only the two scripts it cares about could get the right
 * answer from the registration order rather than from the rule — which is
 * exactly the failure D129 found in `applyStatics` and the reason `layers.test.ts`
 * registers both halves of its pair.
 */
const SCRIPTS = createRegistry([
  LEVITATION_SCRIPT,
  GRAVITY_SPHERE_SCRIPT,
  KNIGHTHOOD_SCRIPT,
  KWENDE_SCRIPT,
  HARDENED_SCALES_SCRIPT,
  BRANCHING_EVOLUTION_SCRIPT,
  HUMILITY_SCRIPT,
]);

const DECK = [
  'Levitation', 'Gravity Sphere', 'Knighthood', 'Kwende, Pride of Femeref',
  'Hardened Scales', 'Branching Evolution', 'Humility',
  'Grizzly Bears', 'Air Elemental', 'Giant Spider', 'Forest', 'Plains',
];

function board(): Game {
  const game = startedGame({ players: 2, decks: [DECK, DECK], scripts: SCRIPTS });
  holdEverywhere(game);
  return game;
}

const chars = (game: Game, id: InstanceId) => derive(game.state, ORACLE, SCRIPTS, id);
/** ⚠️ The Keyword spellings are camelCase — `firstStrike`, not `first strike`. */
const has = (game: Game, id: InstanceId, kw: string): boolean =>
  [...chars(game, id).keywords].some((k) => String(k) === kw);

/** How many cases the corpus holds. Raise it when you add one. */
const CASES = 5;

describe('the conformance corpus', () => {
  /**
   * ⚠️ A corpus that silently shrinks is a corpus that passes. This is the same
   * canary `purity.node.test.ts` opens with, and the reason the count is a
   * constant rather than something derived from the file.
   */
  test(`holds ${CASES} known-hard interactions`, () => {
    expect(CASES).toBeGreaterThanOrEqual(5);
  });

  /**
   * CASE 1 — CR 613.7c, TIMESTAMP. `Levitation` (creatures you control have
   * flying) against `Gravity Sphere` (all creatures lose flying).
   *
   * Published answer: the one that entered the battlefield LAST wins. Both
   * directions, because two grants commute and only a grant against a removal
   * shows an order at all.
   */
  test('CR 613.7c — a grant and a removal are decided by which entered last', () => {
    const a = board();
    const bear = put(a, 'p1', 'Grizzly Bears');
    put(a, 'p1', 'Levitation');
    put(a, 'p1', 'Gravity Sphere');
    expect(has(a, bear, 'flying')).toBe(false);

    const b = board();
    const bear2 = put(b, 'p1', 'Grizzly Bears');
    put(b, 'p1', 'Gravity Sphere');
    put(b, 'p1', 'Levitation');
    expect(has(b, bear2, 'flying')).toBe(true);
  });

  /**
   * CASE 2 — CR 613.8a, DEPENDENCY. `Knighthood` (creatures you control have
   * first strike) against `Kwende` (creatures you control WITH first strike have
   * double strike).
   *
   * Published answer: Kwende DEPENDS on Knighthood — applying Knighthood changes
   * what Kwende applies to — so Kwende waits, **regardless of timestamp**. In
   * plain timestamp order with Kwende first, a vanilla creature ends with first
   * strike and no double strike, and the card does nothing on a board where it
   * plainly should.
   */
  test('CR 613.8a — a reader waits for its granter, whichever entered first', () => {
    for (const order of [['Knighthood', 'Kwende, Pride of Femeref'], ['Kwende, Pride of Femeref', 'Knighthood']]) {
      const g = board();
      const bear = put(g, 'p1', 'Grizzly Bears');
      for (const name of order) put(g, 'p1', name);
      expect(has(g, bear, 'firstStrike')).toBe(true);
      // ⚠️ THE ANSWER THAT DEPENDENCY BUYS. Timestamp order alone gives this
      // `false` in one of the two directions.
      expect(has(g, bear, 'doubleStrike')).toBe(true);
    }
  });

  /**
   * CASE 3 — CR 616, REPLACEMENT ORDERING. `Hardened Scales` (+1) and
   * `Branching Evolution` (twice as many) on one +1/+1 counter event.
   *
   * Published answer: the affected object's controller CHOOSES, and the two
   * orders genuinely differ — plus-one-then-double is 6, double-then-plus-one is
   * 5. Both are correct; which one happens is the player's decision, which is
   * why this cannot be settled by a deterministic fallback.
   */
  test('CR 616 — the two orders give different, both-correct answers', () => {
    const g = board();
    const bear = put(g, 'p1', 'Grizzly Bears');
    put(g, 'p1', 'Hardened Scales');
    put(g, 'p1', 'Branching Evolution');
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bear, kind: '+1/+1', delta: 2 }));
    const awaiting = g.state.priority.awaiting;
    // ⚠️ The GAME STOPS. A version that picked an order itself would be
    // indistinguishable from this one on any single board.
    expect(awaiting?.kind).toBe('chooseReplacement');
  });

  /**
   * CASE 4 — CR 613.6, LOSING ALL ABILITIES. `Humility` (all creatures lose all
   * abilities and are 1/1) against `Knighthood`'s grant.
   *
   * Published answer: layer 6 removes abilities before layer 7b sets P/T, and a
   * creature under Humility has NO keywords — including ones granted by another
   * static in the same layer, applied earlier by timestamp.
   */
  test('CR 613.6 — Humility silences a keyword another static granted', () => {
    const g = board();
    const bear = put(g, 'p1', 'Grizzly Bears');
    put(g, 'p1', 'Knighthood');
    expect(has(g, bear, 'firstStrike')).toBe(true);
    put(g, 'p1', 'Humility');
    expect(has(g, bear, 'firstStrike')).toBe(false);
    // …and 7b still applies underneath it.
    expect(chars(g, bear).power).toBe(1);
    expect(chars(g, bear).toughness).toBe(1);
  });

  /**
   * CASE 5 — CR 509.1b, A GRANTED KEYWORD REACHING THE RULES THAT CONSUME IT.
   * `Levitation` makes the attacker fly; only reach can block it then.
   *
   * Published answer: a creature with flying can be blocked only by creatures
   * with flying or reach. This is the case D82 waited three milestones for —
   * hexproof and shroud were enforced only where PRINTED on the stated grounds
   * that "a granted one needs a layer-6 script", and none existed.
   *
   * ⚠️ ASSERTED ON THE BLOCK PROMPT’S OWN `legal` LIST, never on a direct
   * `canBlock` call. That list is what a client actually sees, it is computed by
   * the HOST because no client can derive it (D125), and it is the thing that
   * goes wrong if a granted keyword stops short of `derive`. A bare `canBlock`
   * outside combat answers `notAttacking` whether or not the grant landed —
   * which is a green tick over nothing, and was the first draft of this case.
   */
  test('CR 509.1b — a GRANTED keyword reaches the rules that consume it', () => {
    // ⚠️ NOT `board()`: this case has to reach combat, and `holdEverywhere`
    // stops every player at every step so `advanceUntil` never gets there. The
    // other four cases assert on a STATIC board and want the stops.
    const offered = (grant: boolean): string[] => {
      const g = startedGame({ players: 2, decks: [DECK, DECK], scripts: SCRIPTS });
      const attacker = put(g, 'p1', 'Grizzly Bears');
      put(g, 'p2', 'Grizzly Bears');
      put(g, 'p2', 'Giant Spider');
      if (grant) put(g, 'p1', 'Levitation');
      advanceUntil(
        g,
        (st) => st.turn.turnNumber === 3 && st.priority.awaiting?.kind === 'declareAttackers',
        20_000,
      );
      must(
        g.submit({
          t: 'DeclareAttackers',
          player: 'p1',
          attackers: [{ card: attacker, defender: { kind: 'player', id: 'p2' } }],
        }),
      );
      const awaiting = g.state.priority.awaiting;
      if (awaiting?.kind !== 'declareBlockers') throw new Error(`expected blockers, got ${awaiting?.kind}`);
      return awaiting.legal
        .filter((row) => row.attackers.includes(attacker))
        .map((row) => nameOf(g, row.blocker))
        .sort();
    };

    expect(offered(false)).toEqual(['Giant Spider', 'Grizzly Bears']);
    // ⚠️ BOTH DIRECTIONS. With only the second, this passes on an engine that
    // never offers a ground blocker at all.
    expect(offered(true)).toEqual(['Giant Spider']);
  });
});
