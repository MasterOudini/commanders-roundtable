// `Order of Midnight // Alter Fate` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORDER_OF_MIDNIGHT_ALTER_FATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORDER_OF_MIDNIGHT_ALTER_FATE, "Flying\nThis creature can't block.\nReturn target creature card from your graveyard to your hand. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const ORDER_OF_MIDNIGHT_ALTER_FATE_SCRIPT: CardScript = {
  oracleId: ORDER_OF_MIDNIGHT_ALTER_FATE.oracleId,
  name: ORDER_OF_MIDNIGHT_ALTER_FATE.name,
  combat: [
    {
      abilityId: 'cantBlock-1', face: 0,
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
