// `Lumbering Satyr` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LUMBERING_SATYR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LUMBERING_SATYR, "All creatures have forestwalk. (They can't be blocked as long as defending player controls a Forest.)");

export const LUMBERING_SATYR_SCRIPT: CardScript = {
  oracleId: LUMBERING_SATYR.oracleId,
  name: LUMBERING_SATYR.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes("Creature"),
      modify: (chars) => {
        chars.landwalk = [...chars.landwalk, "Forest"];
      },
    },
  ],
};
