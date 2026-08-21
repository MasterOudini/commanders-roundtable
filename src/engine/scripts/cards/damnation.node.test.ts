// The tripwire under Damnation's whole-card claim: "They can't be
// regenerated." is executed as NOTHING because the engine has no
// regeneration — no shield, no effect that creates one, no SBA that
// consults one. That is only honest while it stays true, so this scan
// fails BY FILE NAME the day anything under src/engine/ implements or
// consults regeneration, and Damnation (and every wipe shipped on the
// same argument) must join the wave that models the interaction. D192.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('the regeneration vacuity argument (Damnation, D192)', () => {
  test('no engine source implements or consults regeneration', () => {
    const dir = join(__dirname, '..', '..');
    const offenders: string[] = [];
    const walk = (d: string): void => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name);
        if (entry.isDirectory()) {
          walk(p);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        if (entry.name.includes('.test.')) continue;
        // ⚠️ The cards SHIPPED ON the vacuity argument carry the printed
        // clause in their own TEXT constants — they are the argument's
        // clients, not implementations. A new wipe with the clause joins
        // this list deliberately, with the D-entry updated beside it
        // (D192 Damnation · D196 Terminate, Wrath of God · D204 Consume the
        // Meek · D205 Crumble · D208 Devour in Shadow · D213 Fissure ·
        // D214 Flesh to Dust · D221 Jokulhaups · D231 Oxidize · D232
        // Perish · D233 Pillage, Plague Wind · D236 Putrefy · D239
        // Reprisal · D240 Retribution of the Meek · D245 Seeds of
        // Innocence).
        if (['damnation.ts', 'terminate.ts', 'wrathOfGod.ts', 'consumeTheMeek.ts', 'crumble.ts', 'devourInShadow.ts', 'fissure.ts', 'fleshToDust.ts', 'jokulhaups.ts', 'oxidize.ts', 'perish.ts', 'pillage.ts', 'plagueWind.ts', 'putrefy.ts', 'reprisal.ts', 'retributionOfTheMeek.ts', 'seedsOfInnocence.ts'].includes(entry.name)) continue;
        if (/\bregenerat/i.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });
});
