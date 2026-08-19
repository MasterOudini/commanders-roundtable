// The registry's construction guard: a DUPLICATE oracleId is refused loudly.
// Without it `byOracle.set` keeps only the second script while the per-def
// indexes append BOTH — a twice-registered card double-fires its triggers
// with `get()` reporting one script. Found by the 2026-08-19 scale review;
// the guard must exist before generated family tables produce memberships.

import { describe, expect, test } from 'vitest';
import { createRegistry } from './registry';
import type { CardScript } from './api';
import type { OracleId } from '../types/ids';

const OID = 'aaaaaaaa-0000-4000-8000-000000000001' as OracleId;

function script(name: string): CardScript {
  return {
    oracleId: OID,
    name,
    triggers: [
      {
        abilityId: 'etb',
        text: 'When this creature enters, you gain 1 life.',
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        matches: () => false,
        label: () => name,
        resolve: () => [],
      },
    ],
  };
}

describe('createRegistry', () => {
  test('a duplicate oracleId throws, naming the card', () => {
    expect(() => createRegistry([script('First'), script('Second')])).toThrow(
      /duplicate script for oracleId .*Second/,
    );
  });

  test('distinct oracleIds register normally', () => {
    const other: CardScript = {
      ...script('Other'),
      oracleId: 'aaaaaaaa-0000-4000-8000-000000000002' as OracleId,
    };
    const reg = createRegistry([script('First'), other]);
    expect(reg.size).toBe(2);
    expect(reg.triggersFor('CardsMoved')).toHaveLength(2);
  });
});
