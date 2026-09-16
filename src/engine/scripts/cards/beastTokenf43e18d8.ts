// `Beast` - a static cantAttackOrBlockAlone
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BEAST_F43E18D8_TOKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BEAST_F43E18D8_TOKEN, "This creature can't attack or block alone.");

export const BEAST_TOKENF43E18D8_SCRIPT: CardScript = {
  oracleId: BEAST_F43E18D8_TOKEN.oracleId,
  name: BEAST_F43E18D8_TOKEN.name,
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
