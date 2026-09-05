// `Hulking Ogre` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HULKING_OGRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HULKING_OGRE, "This creature can't block.");

export const HULKING_OGRE_SCRIPT: CardScript = {
  oracleId: HULKING_OGRE.oracleId,
  name: HULKING_OGRE.name,
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
