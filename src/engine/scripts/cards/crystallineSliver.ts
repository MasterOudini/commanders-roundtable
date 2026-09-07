// `Crystalline Sliver` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRYSTALLINE_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRYSTALLINE_SLIVER, "All Slivers have shroud. (They can't be the targets of spells or abilities.)");

export const CRYSTALLINE_SLIVER_SCRIPT: CardScript = {
  oracleId: CRYSTALLINE_SLIVER.oracleId,
  name: CRYSTALLINE_SLIVER.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Sliver"),
      modify: (chars) => {
        chars.keywords.add("shroud");
      },
    },
  ],
};
