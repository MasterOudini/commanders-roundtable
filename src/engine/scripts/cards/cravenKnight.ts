// `Craven Knight` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRAVEN_KNIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRAVEN_KNIGHT, "This creature can't block.");

export const CRAVEN_KNIGHT_SCRIPT: CardScript = {
  oracleId: CRAVEN_KNIGHT.oracleId,
  name: CRAVEN_KNIGHT.name,
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
