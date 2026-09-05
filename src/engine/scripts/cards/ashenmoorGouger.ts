// `Ashenmoor Gouger` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ASHENMOOR_GOUGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASHENMOOR_GOUGER, "This creature can't block.");

export const ASHENMOOR_GOUGER_SCRIPT: CardScript = {
  oracleId: ASHENMOOR_GOUGER.oracleId,
  name: ASHENMOOR_GOUGER.name,
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
