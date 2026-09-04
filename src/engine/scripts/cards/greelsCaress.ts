// `Greel's Caress` - an Aura (Enchant creature): the enchanted creature gets -3/+0.
// The Enchant line is the engine's own - the cast aims by it and CR 704.5m keeps it
// (D304); the rest are defs whose one candidate is whatever the Aura is attached to.
// Generated from one table row.

import { GREEL_S_CARESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GREEL_S_CARESS, "Flash\nEnchant creature\nEnchanted creature gets -3/-0.");
const LINES = PRINTED.split('\n');

export const GREELS_CARESS_SCRIPT: CardScript = {
  oracleId: GREEL_S_CARESS.oracleId,
  name: GREEL_S_CARESS.name,
  statics: [
    {
      abilityId: 'enchanted-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Aura is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += -3;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
