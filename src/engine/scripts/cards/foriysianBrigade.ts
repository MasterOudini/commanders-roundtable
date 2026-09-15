// `Foriysian Brigade` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORIYSIAN_BRIGADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORIYSIAN_BRIGADE, "This creature can block an additional creature each combat.");

export const FORIYSIAN_BRIGADE_SCRIPT: CardScript = {
  oracleId: FORIYSIAN_BRIGADE.oracleId,
  name: FORIYSIAN_BRIGADE.name,
  combat: [
    {
      abilityId: 'blockCapacity-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null),
    },
  ],
};
