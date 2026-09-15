// `Night Market Guard` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIGHT_MARKET_GUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIGHT_MARKET_GUARD, "This creature can block an additional creature each combat.");

export const NIGHT_MARKET_GUARD_SCRIPT: CardScript = {
  oracleId: NIGHT_MARKET_GUARD.oracleId,
  name: NIGHT_MARKET_GUARD.name,
  combat: [
    {
      abilityId: 'blockCapacity-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null),
    },
  ],
};
