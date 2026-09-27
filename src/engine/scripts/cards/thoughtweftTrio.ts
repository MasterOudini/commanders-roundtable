// `Thoughtweft Trio` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THOUGHTWEFT_TRIO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THOUGHTWEFT_TRIO, "First strike, vigilance\nChampion a Kithkin (When this enters, sacrifice it unless you exile another Kithkin you control. When this leaves the battlefield, that card returns to the battlefield.)\nThis creature can block any number of creatures.");
const LINES = PRINTED.split('\n');

export const THOUGHTWEFT_TRIO_SCRIPT: CardScript = {
  oracleId: THOUGHTWEFT_TRIO.oracleId,
  name: THOUGHTWEFT_TRIO.name,
  combat: [
    {
      abilityId: 'blockCapacity-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? Infinity : null),
    },
  ],
};
