// `Luminous Bonds` - an Aura (Enchant creature): the enchanted creature cannot attack or block.
// The Enchant line is the engine's own - the cast aims by it and CR 704.5m keeps it
// (D304); the rest are defs whose one candidate is whatever the Aura is attached to.
// Generated from one table row.

import { LUMINOUS_BONDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LUMINOUS_BONDS, "Enchant creature\nEnchanted creature can't attack or block.");
const LINES = PRINTED.split('\n');

export const LUMINOUS_BONDS_SCRIPT: CardScript = {
  oracleId: LUMINOUS_BONDS.oracleId,
  name: LUMINOUS_BONDS.name,
  combat: [
    {
      abilityId: 'enchanted-combat-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttack: (ctx, self, candidate) => ctx.state.cards[self]?.attachedTo !== candidate,
      canBlock: (ctx, self, blocker) => ctx.state.cards[self]?.attachedTo !== blocker,
    },
  ],
};
