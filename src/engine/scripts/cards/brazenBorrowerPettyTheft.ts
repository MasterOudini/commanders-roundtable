// `Brazen Borrower // Petty Theft` - a static blocksOnlyFlying
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRAZEN_BORROWER_PETTY_THEFT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(BRAZEN_BORROWER_PETTY_THEFT, "Flash\nFlying\nThis creature can block only creatures with flying.\nReturn target nonland permanent an opponent controls to its owner's hand.");
const LINES = PRINTED.split('\n');

export const BRAZEN_BORROWER_PETTY_THEFT_SCRIPT: CardScript = {
  oracleId: BRAZEN_BORROWER_PETTY_THEFT.oracleId,
  name: BRAZEN_BORROWER_PETTY_THEFT.name,
  combat: [
    {
      abilityId: 'blocksOnlyFlying-2', face: 0,
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== self || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};
