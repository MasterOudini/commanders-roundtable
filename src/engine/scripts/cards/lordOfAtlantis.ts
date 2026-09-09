// `Lord of Atlantis` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LORD_OF_ATLANTIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LORD_OF_ATLANTIS, "Other Merfolk get +1/+1 and have islandwalk. (They can't be blocked as long as defending player controls an Island.)");

export const LORD_OF_ATLANTIS_SCRIPT: CardScript = {
  oracleId: LORD_OF_ATLANTIS.oracleId,
  name: LORD_OF_ATLANTIS.name,
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Merfolk"),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Merfolk"),
      modify: (chars) => {
        chars.landwalk = [...chars.landwalk, "Island"];
      },
    },
  ],
};
