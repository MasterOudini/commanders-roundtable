// `Dauthi Horror` - a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAUTHI_HORROR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAUTHI_HORROR, "Shadow (This creature can block or be blocked by only creatures with shadow.)\nThis creature can't be blocked by white creatures.");
const LINES = PRINTED.split('\n');

export const DAUTHI_HORROR_SCRIPT: CardScript = {
  oracleId: DAUTHI_HORROR.oracleId,
  name: DAUTHI_HORROR.name,
  combat: [
    {
      abilityId: 'cantBeBlockedBy-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Creature') && ctx.derive(blocker).colors.includes('W')),
    },
  ],
};
