// `Barrenton Cragtreads` - a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BARRENTON_CRAGTREADS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BARRENTON_CRAGTREADS, "This creature can't be blocked by red creatures.");

export const BARRENTON_CRAGTREADS_SCRIPT: CardScript = {
  oracleId: BARRENTON_CRAGTREADS.oracleId,
  name: BARRENTON_CRAGTREADS.name,
  combat: [
    {
      abilityId: 'cantBeBlockedBy-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Creature') && ctx.derive(blocker).colors.includes('R')),
    },
  ],
};
