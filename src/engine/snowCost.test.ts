// D363 — `{S}` IS A COST THIS ENGINE CANNOT CHARGE, and until now it charged it
// as ordinary generic mana. `mana.ts` folded `cost.snow` into the generic
// requirement, so `{1}{S}` was priced as `{2}` and Arcum's Astrolabe — a shipped
// fixture, in the bot's own pool — could be cast off two Mountains. Both
// Commander-legal cards printing `{S}` in a mana cost were counted COMPLETE while
// the engine enforced no snow at all.
//
// CR 107.4s: {S} is one mana produced by a SNOW SOURCE. This engine records no
// provenance for the mana in a pool, so the honest answer is D90's: the cost is
// unpayable, the cast is offered as unaffordable, and the accounting stops
// claiming the card. Building the concept is its own decision.

import { describe, expect, test } from 'vitest';
import { buildPaymentProblem } from './mana';
import { affordable } from './payment';
import { parseManaCost } from '../data/oracleParse';
import { engineCompleteness } from '../data/engineComplete';
import { ARCUM_S_ASTROLABE } from '../data/fixtures/engineCards';
import { EMPTY_POOL } from './types/mana';

const problemFor = (raw: string) => buildPaymentProblem(parseManaCost(raw), 0, [], 0, 0);
const richInput = { pool: { ...EMPTY_POOL, R: 5, G: 5 }, sources: [], lifeAvailable: 40, eventCount: 0 };

describe('D363 - the snow cost', () => {
  test('the requirement is no longer folded into generic', () => {
    const p = problemFor('{1}{S}');
    expect(p.snow).toBe(1);
    expect(p.generic).toBe(1);
  });

  test('five mana of any colour cannot pay {1}{S}, and could before', () => {
    expect(affordable(richInput, problemFor('{1}{S}'))).toBe(false);
    expect(affordable(richInput, problemFor('{S}'))).toBe(false);
    // ⚠️ The teeth: an ordinary cost of the same mana value is still affordable,
    // so the refusal is about the SNOW symbol and not about the arithmetic.
    expect(affordable(richInput, problemFor('{2}'))).toBe(true);
  });

  test("Arcum's Astrolabe is no longer counted as a card the engine runs", () => {
    const c = engineCompleteness(ARCUM_S_ASTROLABE);
    expect(c.complete).toBe(false);
    expect(c.leftover.join(' ')).toContain('{S}');
  });
});
