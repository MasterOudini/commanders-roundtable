// `Asha's Favor` - an Aura (Enchant creature): the enchanted creature has flying, firstStrike, vigilance.
// The Enchant line is the engine's own - the cast aims by it and CR 704.5m keeps it
// (D304); the rest are defs whose one candidate is whatever the Aura is attached to.
// Generated from one table row.

import { ASHA_S_FAVOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASHA_S_FAVOR, "Enchant creature\nEnchanted creature has flying, first strike, and vigilance.");
const LINES = PRINTED.split('\n');

export const ASHAS_FAVOR_SCRIPT: CardScript = {
  oracleId: ASHA_S_FAVOR.oracleId,
  name: ASHA_S_FAVOR.name,
  statics: [
    {
      abilityId: 'enchanted-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Aura is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
        chars.keywords.add("firstStrike");
        chars.keywords.add("vigilance");
      },
    },
  ],
};
