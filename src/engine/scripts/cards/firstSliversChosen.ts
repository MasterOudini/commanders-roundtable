// `First Sliver's Chosen` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRST_SLIVER_S_CHOSEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRST_SLIVER_S_CHOSEN, "Sliver creatures you control have exalted. (Whenever a creature you control attacks alone, it gets +1/+1 until end of turn for each instance of exalted among permanents you control.)");

export const FIRST_SLIVERS_CHOSEN_SCRIPT: CardScript = {
  oracleId: FIRST_SLIVER_S_CHOSEN.oracleId,
  name: FIRST_SLIVER_S_CHOSEN.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Sliver") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("exalted");
      },
    },
  ],
};
