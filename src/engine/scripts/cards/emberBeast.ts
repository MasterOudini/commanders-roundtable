// `Ember Beast` - a static cantAttackOrBlockAlone
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMBER_BEAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMBER_BEAST, "This creature can't attack or block alone.");

export const EMBER_BEAST_SCRIPT: CardScript = {
  oracleId: EMBER_BEAST.oracleId,
  name: EMBER_BEAST.name,
  combat: [
    {
      abilityId: 'cantAttackOrBlockAlone-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canAttackAlone: (_ctx, self, candidate) => candidate !== self,
      canBlockAlone: (_ctx, self, candidate) => candidate !== self,
    },
  ],
};
