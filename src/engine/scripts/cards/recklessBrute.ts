// `Reckless Brute` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RECKLESS_BRUTE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(RECKLESS_BRUTE, "Haste (This creature can attack and {T} as soon as it comes under your control.)\nThis creature attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const RECKLESS_BRUTE_SCRIPT: CardScript = {
  oracleId: RECKLESS_BRUTE.oracleId,
  name: RECKLESS_BRUTE.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
