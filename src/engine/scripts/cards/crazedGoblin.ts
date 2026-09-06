// `Crazed Goblin` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRAZED_GOBLIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRAZED_GOBLIN, "This creature attacks each combat if able.");

export const CRAZED_GOBLIN_SCRIPT: CardScript = {
  oracleId: CRAZED_GOBLIN.oracleId,
  name: CRAZED_GOBLIN.name,
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
