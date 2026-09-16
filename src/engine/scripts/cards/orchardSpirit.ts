// `Orchard Spirit` - a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORCHARD_SPIRIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORCHARD_SPIRIT, "This creature can't be blocked except by creatures with flying or reach.");

export const ORCHARD_SPIRIT_SCRIPT: CardScript = {
  oracleId: ORCHARD_SPIRIT.oracleId,
  name: ORCHARD_SPIRIT.name,
  combat: [
    {
      abilityId: 'cantBeBlockedBy-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).typeLine.types.includes('Creature') && (ctx.derive(blocker).keywords.has('flying') || ctx.derive(blocker).keywords.has('reach'))),
    },
  ],
};
