// `Ninja` - a static cantBeBlocked
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NINJA_14EB629E_TOKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NINJA_14EB629E_TOKEN, "This creature can't be blocked.");

export const NINJA_TOKEN14EB629E_SCRIPT: CardScript = {
  oracleId: NINJA_14EB629E_TOKEN.oracleId,
  name: NINJA_14EB629E_TOKEN.name,
  combat: [
    {
      abilityId: 'cantBeBlocked-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
