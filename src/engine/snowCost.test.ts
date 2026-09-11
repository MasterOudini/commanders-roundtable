// D364 — `{S}` IS ONE MANA FROM A SNOW SOURCE, and the engine charges it now.
//
// D363 REFUSED this cost, and was right to: `mana.ts` folded `cost.snow` into the
// generic requirement, so `{1}{S}` was priced as `{2}` and Arcum's Astrolabe — a
// shipped script, in the bot's own pool — could be cast off two Mountains. With no
// record of where a pool's mana came from, "unpayable" was the honest answer and
// the accounting stopped claiming both cards.
//
// D364 gave the pool that record. `PlayerState.poolSnow` is a SUB-POOL (of the mana
// you hold, this much came from a snow source), `ManaAdded` carries the flag from
// the source that made it, and `payment.ts` RESERVES the snow before the solver
// runs — so the three tiers and the min-cost max-flow are untouched.
//
// ⚠️ MOST OF D363'S SUITE IS STILL TRUE and is kept: the requirement is still not
// generic, and five ordinary mana still cannot pay `{S}`. That second one is
// sharper now than it was — under D363 it passed because NOTHING could pay a snow
// cost; here it passes because this particular mana came from the wrong place.

import { describe, expect, test } from 'vitest';
import { buildPaymentProblem } from './mana';
import { affordable, suggestPayment } from './payment';
import { parseManaCost } from '../data/oracleParse';
import { engineCompleteness } from '../data/engineComplete';
import { ARCUM_S_ASTROLABE } from '../data/fixtures/engineCards';
import { EMPTY_POOL } from './types/mana';
import type { ManaSource } from './mana';
import type { SolveInput } from './payment';

const problemFor = (raw: string) => buildPaymentProblem(parseManaCost(raw), 0, [], 0, 0);

/** A board with plenty of ordinary mana in the pool and nothing snow about it. */
const ordinary: SolveInput = {
  pool: { ...EMPTY_POOL, R: 5, G: 5 },
  poolSnow: EMPTY_POOL,
  poolRestricted: [],
  sources: [],
  lifeAvailable: 40,
  eventCount: 0,
};

/** The same pool, except two of the green came from a snow source. */
const withSnowMana: SolveInput = { ...ordinary, poolSnow: { ...EMPTY_POOL, G: 2 } };

const snowLand = (card: string, key: 'G' | 'U', snow: boolean, rank = 0): ManaSource => ({
  card,
  abilityIndex: 0,
  outputs: [{ mana: { ...EMPTY_POOL, [key]: 1 }, amount: 1 }],
  requiresTap: true,
  conditional: false,
  snow,
  restriction: null,
  flexibilityRank: rank,
});

describe('D364 - the snow cost, parsed', () => {
  // D363's, unchanged: the requirement never went into generic.
  test('the requirement is its own field, not part of generic', () => {
    const p = problemFor('{1}{S}');
    expect(p.snow).toBe(1);
    expect(p.generic).toBe(1);
    expect(problemFor('{S}{S}').snow).toBe(2);
  });
});

describe('D364 - what can and cannot pay it', () => {
  // ⚠️ D363's test, kept because it is still true and now says something sharper:
  // the refusal is about WHERE the mana came from, not about the arithmetic.
  test('ten ordinary mana cannot pay {S}', () => {
    expect(affordable(ordinary, problemFor('{1}{S}'))).toBe(false);
    expect(affordable(ordinary, problemFor('{S}'))).toBe(false);
    // The teeth: the same mana value with no snow symbol is affordable, so the
    // refusal is the snow and not the cost.
    expect(affordable(ordinary, problemFor('{2}'))).toBe(true);
  });

  test('mana already in the pool from a snow source pays it', () => {
    expect(affordable(withSnowMana, problemFor('{S}'))).toBe(true);
    expect(affordable(withSnowMana, problemFor('{1}{S}'))).toBe(true);
    // Two snow mana held, two snow symbols: exactly enough.
    expect(affordable(withSnowMana, problemFor('{S}{S}'))).toBe(true);
    // Three is one more than the pool can answer.
    expect(affordable(withSnowMana, problemFor('{S}{S}{S}'))).toBe(false);
  });

  test('an untapped snow source pays it, and an ordinary land does not', () => {
    const snow: SolveInput = { ...ordinary, pool: EMPTY_POOL, sources: [snowLand('c1', 'G', true)] };
    const plain: SolveInput = { ...ordinary, pool: EMPTY_POOL, sources: [snowLand('c1', 'G', false)] };
    expect(affordable(snow, problemFor('{S}'))).toBe(true);
    expect(affordable(plain, problemFor('{S}'))).toBe(false);
  });

  test('the colour of the snow mana does not matter - only its source', () => {
    const blue: SolveInput = { ...ordinary, pool: EMPTY_POOL, sources: [snowLand('c1', 'U', true)] };
    expect(affordable(blue, problemFor('{S}'))).toBe(true);
  });
});

describe('D364 - the plan', () => {
  test('the plan taps the snow source for the {S}', () => {
    const input: SolveInput = {
      ...ordinary,
      pool: EMPTY_POOL,
      sources: [snowLand('plain', 'G', false, 0), snowLand('snowy', 'G', true, 1)],
    };
    const plan = suggestPayment(input, problemFor('{1}{S}'));
    expect(plan).not.toBeNull();
    // Both lands are tapped - one for the snow symbol, one for the generic - and the
    // snow one is in the plan, which is the half that could have gone wrong.
    expect(plan?.taps.map((t) => t.source).sort()).toEqual(['plain', 'snowy']);
  });

  // ⚠️ THE RESERVATION PREFERS THE LEAST FLEXIBLE SNOW SOURCE, which is what keeps
  // it from spending a source a colour needed. `flexibilityRank` exists for exactly
  // this judgement and is why the solver itself needed no changing.
  test('with two snow sources it reserves the less flexible one', () => {
    const input: SolveInput = {
      ...ordinary,
      pool: EMPTY_POOL,
      sources: [snowLand('flexible', 'G', true, 6), snowLand('basic', 'G', true, 0)],
    };
    const plan = suggestPayment(input, problemFor('{S}'));
    expect(plan?.taps).toHaveLength(1);
    expect(plan?.taps[0]?.source).toBe('basic');
  });

  test('a board with no snow at all makes no plan for a snow cost', () => {
    expect(suggestPayment(ordinary, problemFor('{S}'))).toBeNull();
  });
});

describe('D364 - the accounting', () => {
  // ⚠️ THIS IS THE ONE THAT CHANGED SIDES. D363 asserted the Astrolabe was NOT a card
  // the engine runs, because the engine could not charge its cost. It can now, so the
  // old assertion is gone rather than adapted (D117): a test that describes a meaning
  // the engine has stopped having is rewritten, not bent.
  test("Arcum's Astrolabe is a card the engine runs again", () => {
    const c = engineCompleteness(ARCUM_S_ASTROLABE);
    expect(c.complete).toBe(true);
    expect(c.leftover).toEqual([]);
  });
});
