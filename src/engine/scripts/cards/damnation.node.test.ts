// The tripwire under Damnation's whole-card claim, rewritten for D330.
//
// D192's argument was VACUITY: "They can't be regenerated." executed as
// nothing because the engine had no regeneration, and this scan failed by
// file name the day anything under src/engine/ implemented or consulted
// one. D330 built the shield (CR 701.19). The claim now rests on two facts
// this test pins instead:
//   1. the seam lives in exactly the files that are known to hold it - a
//      new file that mentions regeneration must join this list on purpose,
//      with its D-entry, and
//   2. every wipe shipped on the old argument still carries the printed
//      clause and never consults the shield: it moves the creatures itself,
//      so a shielded creature dies to it exactly as the rules say (proven
//      end to end for Damnation in `src/engine/regeneration.test.ts`).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

/** The wipes shipped on the vacuity argument (D192 ... D297), by module. */
const WIPES_WITH_THE_CLAUSE = [
  'damnation.ts', 'terminate.ts', 'wrathOfGod.ts', 'consumeTheMeek.ts', 'crumble.ts', 'devourInShadow.ts', 'fissure.ts',
  'fleshToDust.ts', 'jokulhaups.ts', 'oxidize.ts', 'perish.ts', 'pillage.ts', 'plagueWind.ts', 'putrefy.ts', 'reprisal.ts',
  'retributionOfTheMeek.ts', 'seedsOfInnocence.ts', 'shatterstorm.ts', 'smother.ts', 'windsOfRath.ts', 'darkHatchling.ts',
  'murderousSpoils.ts', 'notoriousAssassin.ts', 'phyrexianBloodstock.ts', 'pitTrap.ts', 'plagueSpores.ts', 'sealOfDoom.ts',
  'severSoul.ts', 'vendetta.ts', 'visaraTheDreadful.ts', 'wordOfBlasting.ts',
];

/** D330 - where the engine implements or consults the regeneration shield. */
const THE_SEAM = [
  'effects.ts',
  'log.ts',
  'loop.ts',
  'reducer.ts',
  'sba.ts',
  // D373 - the vocabulary bridge names `regenerate` in NEEDS_AIM, because the verb the
  // parser learned in D373 is aimable: a granted "Regenerate this permanent." resolves
  // against the RECIPIENT (CR 113.7a). It consults the seam by naming it, not by reading
  // the shield, so it joins the list rather than changing what the list means.
  'scripts/vocabulary.ts',
  'types/events.ts',
  'types/oracle.ts',
  'types/state.ts',
];

describe('the regeneration tripwire (Damnation, D192; the seam, D330)', () => {
  const engineDir = join(__dirname, '..', '..');
  const cardsDir = __dirname;

  test('the seam lives in exactly the files known to hold it', () => {
    const found: string[] = [];
    const walk = (d: string): void => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name);
        if (entry.isDirectory()) {
          // Card scripts are the seam's CLIENTS (a regenerate line in their
          // printed text and a shield event in their defs), never the seam.
          if (p === cardsDir) continue;
          walk(p);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        if (entry.name.includes('.test.')) continue;
        if (/\bregenerat/i.test(readFileSync(p, 'utf8'))) found.push(relative(engineDir, p).replace(/\\/g, '/'));
      }
    };
    walk(engineDir);
    expect(found.sort()).toEqual([...THE_SEAM].sort());
  });

  test('every wipe shipped on the vacuity argument still says the clause and never consults the shield', () => {
    // The old list named a few wipes by their fixture rather than a module of
    // their own (Terminate, Wrath of God resolve through `effectParse`); the
    // check is over the modules that exist.
    const shipped = WIPES_WITH_THE_CLAUSE.filter((name) => existsSync(join(cardsDir, name)));
    expect(shipped.length).toBeGreaterThanOrEqual(25);
    for (const name of shipped) {
      const source = readFileSync(join(cardsDir, name), 'utf8');
      expect(source, name).toMatch(/can't be regenerated/);
      expect(source, name).not.toMatch(/regenerationShields|RegenerationShieldAdded|Regenerated/);
    }
  });
});
