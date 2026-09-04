// `Imposing Visage` - an Aura (Enchant creature): the enchanted creature has menace.
// The Enchant line is the engine's own - the cast aims by it and CR 704.5m keeps it
// (D304); the rest are defs whose one candidate is whatever the Aura is attached to.
// Generated from one table row.

import { IMPOSING_VISAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IMPOSING_VISAGE, "Enchant creature\nEnchanted creature has menace. (It can't be blocked except by two or more creatures.)");
const LINES = PRINTED.split('\n');

export const IMPOSING_VISAGE_SCRIPT: CardScript = {
  oracleId: IMPOSING_VISAGE.oracleId,
  name: IMPOSING_VISAGE.name,
  statics: [
    {
      abilityId: 'enchanted-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Aura is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};
