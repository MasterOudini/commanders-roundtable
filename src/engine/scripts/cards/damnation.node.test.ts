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
        if (entry.name === 'damnation.ts') continue; // this card's own comment
        if (/\bregenerat/i.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });
});
