// `Reckless Imp` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RECKLESS_IMP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RECKLESS_IMP, "Flying\nThis creature can't block.\nDash {1}{B} (You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.)");
const LINES = PRINTED.split('\n');

export const RECKLESS_IMP_SCRIPT: CardScript = {
  oracleId: RECKLESS_IMP.oracleId,
  name: RECKLESS_IMP.name,
  combat: [
    {
      abilityId: 'cantBlock-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
