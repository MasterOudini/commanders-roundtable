// `Feast of the Unicorn` - an Aura (Enchant creature): the enchanted creature gets +4/+0.
// The Enchant line is the engine's own - the cast aims by it and CR 704.5m keeps it
// (D304); the rest are defs whose one candidate is whatever the Aura is attached to.
// Generated from one table row.

import { FEAST_OF_THE_UNICORN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FEAST_OF_THE_UNICORN, "Enchant creature\nEnchanted creature gets +4/+0.");
const LINES = PRINTED.split('\n');

export const FEAST_OF_THE_UNICORN_SCRIPT: CardScript = {
  oracleId: FEAST_OF_THE_UNICORN.oracleId,
  name: FEAST_OF_THE_UNICORN.name,
  statics: [
    {
      abilityId: 'enchanted-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Aura is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 4;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
