// `Diplomatic Immunity` - an Aura (Enchant creature): the enchanted creature has shroud.
// The Enchant line is the engine's own - the cast aims by it and CR 704.5m keeps it
// (D304); the rest are defs whose one candidate is whatever the Aura is attached to.
// Generated from one table row.

import { DIPLOMATIC_IMMUNITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIPLOMATIC_IMMUNITY, "Enchant creature\nShroud (A permanent with shroud can't be the target of spells or abilities.)\nEnchanted creature has shroud.");
const LINES = PRINTED.split('\n');

export const DIPLOMATIC_IMMUNITY_SCRIPT: CardScript = {
  oracleId: DIPLOMATIC_IMMUNITY.oracleId,
  name: DIPLOMATIC_IMMUNITY.name,
  statics: [
    {
      abilityId: 'enchanted-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Aura is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("shroud");
      },
    },
  ],
};
