// `Lavaleaper` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LAVALEAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LAVALEAPER, "All creatures have haste.\nWhenever a player taps a basic land for mana, that player adds one mana of any type that land produced.");
const LINES = PRINTED.split('\n');

export const LAVALEAPER_SCRIPT: CardScript = {
  oracleId: LAVALEAPER.oracleId,
  name: LAVALEAPER.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes("Creature"),
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
  ],
};
