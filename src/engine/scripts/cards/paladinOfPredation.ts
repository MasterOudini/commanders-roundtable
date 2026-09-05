// `Paladin of Predation` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PALADIN_OF_PREDATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PALADIN_OF_PREDATION, "Toxic 6 (Players dealt combat damage by this creature also get six poison counters.)\nThis creature can't be blocked by creatures with power 2 or less.");
const LINES = PRINTED.split('\n');

export const PALADIN_OF_PREDATION_SCRIPT: CardScript = {
  oracleId: PALADIN_OF_PREDATION.oracleId,
  name: PALADIN_OF_PREDATION.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
