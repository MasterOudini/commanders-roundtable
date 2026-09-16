// `Steely Resolve` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEELY_RESOLVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEELY_RESOLVE, "As this enchantment enters, choose a creature type.\nCreatures of the chosen type have shroud. (They can't be the targets of spells or abilities.)");
const LINES = PRINTED.split('\n');

export const STEELY_RESOLVE_SCRIPT: CardScript = {
  oracleId: STEELY_RESOLVE.oracleId,
  name: STEELY_RESOLVE.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes(ctx.state.cards[self]?.chosenType ?? ''),
      modify: (chars) => {
        chars.keywords.add("shroud");
      },
    },
  ],
};
