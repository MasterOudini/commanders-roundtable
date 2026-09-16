// `Cover of Darkness` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COVER_OF_DARKNESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COVER_OF_DARKNESS, "As this enchantment enters, choose a creature type.\nCreatures of the chosen type have fear. (They can't be blocked except by artifact creatures and/or black creatures.)");
const LINES = PRINTED.split('\n');

export const COVER_OF_DARKNESS_SCRIPT: CardScript = {
  oracleId: COVER_OF_DARKNESS.oracleId,
  name: COVER_OF_DARKNESS.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes(ctx.state.cards[self]?.chosenType ?? ''),
      modify: (chars) => {
        chars.keywords.add("fear");
      },
    },
  ],
};
