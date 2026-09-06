// `Flameborn Hellion` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLAMEBORN_HELLION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLAMEBORN_HELLION, "Haste\nThis creature attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const FLAMEBORN_HELLION_SCRIPT: CardScript = {
  oracleId: FLAMEBORN_HELLION.oracleId,
  name: FLAMEBORN_HELLION.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
