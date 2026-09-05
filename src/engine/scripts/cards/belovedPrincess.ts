// `Beloved Princess` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BELOVED_PRINCESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BELOVED_PRINCESS, "Lifelink\nThis creature can't be blocked by creatures with power 3 or greater.");
const LINES = PRINTED.split('\n');

export const BELOVED_PRINCESS_SCRIPT: CardScript = {
  oracleId: BELOVED_PRINCESS.oracleId,
  name: BELOVED_PRINCESS.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) < 3,
    },
  ],
};
