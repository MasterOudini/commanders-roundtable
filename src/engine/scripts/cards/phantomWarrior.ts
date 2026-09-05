// `Phantom Warrior` - a static cantBeBlocked
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHANTOM_WARRIOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHANTOM_WARRIOR, "This creature can't be blocked.");

export const PHANTOM_WARRIOR_SCRIPT: CardScript = {
  oracleId: PHANTOM_WARRIOR.oracleId,
  name: PHANTOM_WARRIOR.name,
  combat: [
    {
      abilityId: 'cantBeBlocked-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
