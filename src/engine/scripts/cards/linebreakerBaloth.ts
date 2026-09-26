// `Linebreaker Baloth` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LINEBREAKER_BALOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LINEBREAKER_BALOTH, "Enlist (As this creature attacks, you may tap a nonattacking creature you control without summoning sickness. When you do, add its power to this creature's until end of turn.)\nThis creature can't be blocked by creatures with power 2 or less.");
const LINES = PRINTED.split('\n');

export const LINEBREAKER_BALOTH_SCRIPT: CardScript = {
  oracleId: LINEBREAKER_BALOTH.oracleId,
  name: LINEBREAKER_BALOTH.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
