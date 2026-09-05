// `Amrou Kithkin` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AMROU_KITHKIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AMROU_KITHKIN, "This creature can't be blocked by creatures with power 3 or greater.");

export const AMROU_KITHKIN_SCRIPT: CardScript = {
  oracleId: AMROU_KITHKIN.oracleId,
  name: AMROU_KITHKIN.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) < 3,
    },
  ],
};
