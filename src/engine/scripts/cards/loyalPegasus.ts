// `Loyal Pegasus` - a static cantAttackOrBlockAlone
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOYAL_PEGASUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOYAL_PEGASUS, "Flying\nThis creature can't attack or block alone.");
const LINES = PRINTED.split('\n');

export const LOYAL_PEGASUS_SCRIPT: CardScript = {
  oracleId: LOYAL_PEGASUS.oracleId,
  name: LOYAL_PEGASUS.name,
  combat: [
    {
      abilityId: 'cantAttackOrBlockAlone-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttackAlone: (_ctx, self, candidate) => candidate !== self,
      canBlockAlone: (_ctx, self, candidate) => candidate !== self,
    },
  ],
};
