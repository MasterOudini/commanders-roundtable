// `Fleet-Footed Monk` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLEET_FOOTED_MONK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLEET_FOOTED_MONK, "This creature can't be blocked by creatures with power 2 or greater.");

export const FLEET_FOOTED_MONK_SCRIPT: CardScript = {
  oracleId: FLEET_FOOTED_MONK.oracleId,
  name: FLEET_FOOTED_MONK.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) < 2,
    },
  ],
};
