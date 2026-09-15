// `Charging Rhino` - a static maxBlockers
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHARGING_RHINO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHARGING_RHINO, "This creature can't be blocked by more than one creature.");

export const CHARGING_RHINO_SCRIPT: CardScript = {
  oracleId: CHARGING_RHINO.oracleId,
  name: CHARGING_RHINO.name,
  combat: [
    {
      abilityId: 'maxBlockers-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      maxBlockers: (_ctx, self, attacker) => (attacker === self ? 1 : null),
    },
  ],
};
