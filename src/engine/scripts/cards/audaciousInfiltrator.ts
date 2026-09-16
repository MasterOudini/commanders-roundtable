// `Audacious Infiltrator` - a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AUDACIOUS_INFILTRATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AUDACIOUS_INFILTRATOR, "This creature can't be blocked by artifact creatures.");

export const AUDACIOUS_INFILTRATOR_SCRIPT: CardScript = {
  oracleId: AUDACIOUS_INFILTRATOR.oracleId,
  name: AUDACIOUS_INFILTRATOR.name,
  combat: [
    {
      abilityId: 'cantBeBlockedBy-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Artifact') && ctx.derive(blocker).typeLine.types.includes('Creature')),
    },
  ],
};
