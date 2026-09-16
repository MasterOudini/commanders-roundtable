// `Alien` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALIEN_ECA87CBB_TOKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALIEN_ECA87CBB_TOKEN, "Haste\nThis token attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const ALIEN_TOKENECA87CBB_SCRIPT: CardScript = {
  oracleId: ALIEN_ECA87CBB_TOKEN.oracleId,
  name: ALIEN_ECA87CBB_TOKEN.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
