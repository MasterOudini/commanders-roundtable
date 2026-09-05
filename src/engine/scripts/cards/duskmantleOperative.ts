// `Duskmantle Operative` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUSKMANTLE_OPERATIVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUSKMANTLE_OPERATIVE, "This creature can't be blocked by creatures with power 4 or greater.");

export const DUSKMANTLE_OPERATIVE_SCRIPT: CardScript = {
  oracleId: DUSKMANTLE_OPERATIVE.oracleId,
  name: DUSKMANTLE_OPERATIVE.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) < 4,
    },
  ],
};
