// `Knight of Sorrows` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNIGHT_OF_SORROWS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNIGHT_OF_SORROWS, "This creature can block an additional creature each combat.\nAfterlife 1 (When this creature dies, create a 1/1 white and black Spirit creature token with flying.)");
const LINES = PRINTED.split('\n');

export const KNIGHT_OF_SORROWS_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_SORROWS.oracleId,
  name: KNIGHT_OF_SORROWS.name,
  combat: [
    {
      abilityId: 'blockCapacity-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null),
    },
  ],
};
