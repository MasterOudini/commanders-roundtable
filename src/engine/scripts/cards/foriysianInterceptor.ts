// `Foriysian Interceptor` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORIYSIAN_INTERCEPTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORIYSIAN_INTERCEPTOR, "Flash (You may cast this spell any time you could cast an instant.)\nDefender\nThis creature can block an additional creature each combat.");
const LINES = PRINTED.split('\n');

export const FORIYSIAN_INTERCEPTOR_SCRIPT: CardScript = {
  oracleId: FORIYSIAN_INTERCEPTOR.oracleId,
  name: FORIYSIAN_INTERCEPTOR.name,
  combat: [
    {
      abilityId: 'blockCapacity-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null),
    },
  ],
};
