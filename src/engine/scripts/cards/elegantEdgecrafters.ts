// `Elegant Edgecrafters` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELEGANT_EDGECRAFTERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELEGANT_EDGECRAFTERS, "This creature can't be blocked by creatures with power 2 or less.\nFabricate 2 (When this creature enters, put two +1/+1 counters on it or create two 1/1 colorless Servo artifact creature tokens.)");
const LINES = PRINTED.split('\n');

export const ELEGANT_EDGECRAFTERS_SCRIPT: CardScript = {
  oracleId: ELEGANT_EDGECRAFTERS.oracleId,
  name: ELEGANT_EDGECRAFTERS.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
