// `Young Red Dragon // Bathe in Gold` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YOUNG_RED_DRAGON_BATHE_IN_GOLD } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(YOUNG_RED_DRAGON_BATHE_IN_GOLD, "Flying\nThis creature can't block.\nCreate a Treasure token. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const YOUNG_RED_DRAGON_BATHE_IN_GOLD_SCRIPT: CardScript = {
  oracleId: YOUNG_RED_DRAGON_BATHE_IN_GOLD.oracleId,
  name: YOUNG_RED_DRAGON_BATHE_IN_GOLD.name,
  combat: [
    {
      abilityId: 'cantBlock-1', face: 0,
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
