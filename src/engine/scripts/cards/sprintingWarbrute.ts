// `Sprinting Warbrute` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPRINTING_WARBRUTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPRINTING_WARBRUTE, "This creature attacks each combat if able.\nDash {3}{R} (You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.)");
const LINES = PRINTED.split('\n');

export const SPRINTING_WARBRUTE_SCRIPT: CardScript = {
  oracleId: SPRINTING_WARBRUTE.oracleId,
  name: SPRINTING_WARBRUTE.name,
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
