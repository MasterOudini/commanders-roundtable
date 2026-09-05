// `Goblin Glider` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_GLIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_GLIDER, "Flying\nThis creature can't block.");
const LINES = PRINTED.split('\n');

export const GOBLIN_GLIDER_SCRIPT: CardScript = {
  oracleId: GOBLIN_GLIDER.oracleId,
  name: GOBLIN_GLIDER.name,
  combat: [
    {
      abilityId: 'cantBlock-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
