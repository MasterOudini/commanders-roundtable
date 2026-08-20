// The tripwire under Pinpoint Avalanche's whole-card claim: "The damage
// can't be prevented." is executed as NOTHING because script damage
// never routes through a prevention site — the engine's ONE such site is
// combat.ts's preventedAmount (protection, CR 702.16c), which only the
// combat-damage assignment consults. That is only honest while it stays
// true, so this scan fails the day the noncombat damage pipeline
// (effects.ts, reducer.ts) gains the concept, and Pinpoint Avalanche
// (and every burn shipped on the same argument) must join the wave that
// models the interaction. D233.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('the prevention vacuity argument (Pinpoint Avalanche, D233)', () => {
  test('the noncombat damage pipeline never mentions prevention', () => {
    const engine = join(__dirname, '..', '..');
    for (const file of ['effects.ts', 'reducer.ts']) {
      const src = readFileSync(join(engine, file), 'utf8');
      expect(/\bprevent/i.test(src), `${file} mentions prevention`).toBe(false);
    }
  });

  test('combat.ts still holds the one prevention site', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'combat.ts'), 'utf8');
    expect(src.includes('preventedAmount')).toBe(true);
  });
});
