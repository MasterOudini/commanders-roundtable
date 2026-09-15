// `Rampaging Ceratops` - a static minBlockers
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAMPAGING_CERATOPS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAMPAGING_CERATOPS, "This creature can't be blocked except by three or more creatures.");

export const RAMPAGING_CERATOPS_SCRIPT: CardScript = {
  oracleId: RAMPAGING_CERATOPS.oracleId,
  name: RAMPAGING_CERATOPS.name,
  combat: [
    {
      abilityId: 'minBlockers-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      minBlockers: (_ctx, self, attacker) => (attacker === self ? 3 : null),
    },
  ],
};
