// `Barricade Breaker` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BARRICADE_BREAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BARRICADE_BREAKER, "Improvise (Your artifacts can help cast this spell. Each artifact you tap after you're done activating mana abilities pays for {1}.)\nThis creature attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const BARRICADE_BREAKER_SCRIPT: CardScript = {
  oracleId: BARRICADE_BREAKER.oracleId,
  name: BARRICADE_BREAKER.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
