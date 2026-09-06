// `Bloodrock Cyclops` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODROCK_CYCLOPS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODROCK_CYCLOPS, "This creature attacks each combat if able.");

export const BLOODROCK_CYCLOPS_SCRIPT: CardScript = {
  oracleId: BLOODROCK_CYCLOPS.oracleId,
  name: BLOODROCK_CYCLOPS.name,
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
