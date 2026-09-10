// D233 wrote this as a VACUITY TRIPWIRE: `Pinpoint Avalanche` claims its whole
// text while "The damage can't be prevented." executed as NOTHING, because
// script damage never routed through a prevention site — the engine's ONE such
// site was combat.ts's `preventedAmount` (protection, CR 702.16c), which only
// the combat-damage assignment consults. The test asserted that the noncombat
// pipeline never mentions prevention, so it would fail the day the concept
// arrived and the card had to join the wave that models it.
//
// ⚠️ **IT FIRED, AND THIS IS THAT WAVE (D382).** CR 615 is built: a shield on
// `GameState.preventionShields`, spent by the replacement funnel, which is the
// one place EVERY damage event passes through — so it reaches the hundreds of
// shipped modules that build a `DamageDealt` themselves, which is exactly what
// D233 measured as unreachable. The vacuity argument is gone, so the test that
// rested on it is REWRITTEN rather than adapted (D117), and what it pins now is
// the opposite claim: that prevention exists, that it is applied in ONE place,
// and that the sentence D233 could not model is modelled.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const engine = join(__dirname, '..', '..');

describe('prevention is built, and applied in one place (D382, closing D233)', () => {
  test('the funnel is the one prevention site, and it is not the emitters', () => {
    // The funnel calls it. `effects.ts` builds damage and must NOT consult a
    // shield itself: a second site is a second answer, and the emitters are
    // precisely what a per-emitter check cannot cover (D233's measurement).
    expect(readFileSync(join(engine, 'triggers.ts'), 'utf8')).toContain('withoutPreventedDamage');
    const effects = readFileSync(join(engine, 'effects.ts'), 'utf8');
    expect(effects).toContain('PreventionShieldsAdded');
    expect(effects.includes('withoutPreventedDamage')).toBe(false);
    expect(readFileSync(join(engine, 'prevention.ts'), 'utf8')).toContain('withoutPreventedDamage');
  });

  test('combat.ts still holds protection, which is a different rule', () => {
    // CR 702.16c is not CR 615: protection prevents the damage at the
    // assignment and spends no shield. Keeping them apart is the point.
    const src = readFileSync(join(engine, 'combat.ts'), 'utf8');
    expect(src.includes('preventedAmount')).toBe(true);
  });

  test("Pinpoint Avalanche's second sentence is modelled, not vacuous", () => {
    const src = readFileSync(join(__dirname, 'pinpointAvalanche.ts'), 'utf8');
    expect(src).toContain('unpreventable: true');
  });
});
