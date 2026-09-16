// `Skyscythe Engulfer` - a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYSCYTHE_ENGULFER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYSCYTHE_ENGULFER, "Reach, trample\nThis creature can't be blocked by creatures with flying.");
const LINES = PRINTED.split('\n');

export const SKYSCYTHE_ENGULFER_SCRIPT: CardScript = {
  oracleId: SKYSCYTHE_ENGULFER.oracleId,
  name: SKYSCYTHE_ENGULFER.name,
  combat: [
    {
      abilityId: 'cantBeBlockedBy-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Creature') && ctx.derive(blocker).keywords.has('flying')),
    },
  ],
};
