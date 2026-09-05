// `Outland Boar` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OUTLAND_BOAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OUTLAND_BOAR, "This creature can't be blocked by creatures with power 2 or less.");

export const OUTLAND_BOAR_SCRIPT: CardScript = {
  oracleId: OUTLAND_BOAR.oracleId,
  name: OUTLAND_BOAR.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
