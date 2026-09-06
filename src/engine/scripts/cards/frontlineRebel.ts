// `Frontline Rebel` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FRONTLINE_REBEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FRONTLINE_REBEL, "This creature attacks each combat if able.");

export const FRONTLINE_REBEL_SCRIPT: CardScript = {
  oracleId: FRONTLINE_REBEL.oracleId,
  name: FRONTLINE_REBEL.name,
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
