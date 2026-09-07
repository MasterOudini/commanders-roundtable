// `King of the Pride` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KING_OF_THE_PRIDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KING_OF_THE_PRIDE, "Other Cats you control get +2/+1.");

export const KING_OF_THE_PRIDE_SCRIPT: CardScript = {
  oracleId: KING_OF_THE_PRIDE.oracleId,
  name: KING_OF_THE_PRIDE.name,
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Cat") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
