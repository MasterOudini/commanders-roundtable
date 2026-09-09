// `Eladamri, Lord of Leaves` - a static anthem, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELADAMRI_LORD_OF_LEAVES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELADAMRI_LORD_OF_LEAVES, "Other Elf creatures have forestwalk. (They can't be blocked as long as defending player controls a Forest.)\nOther Elves have shroud. (They can't be the targets of spells or abilities.)");
const LINES = PRINTED.split('\n');

export const ELADAMRI_LORD_OF_LEAVES_SCRIPT: CardScript = {
  oracleId: ELADAMRI_LORD_OF_LEAVES.oracleId,
  name: ELADAMRI_LORD_OF_LEAVES.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Elf"),
      modify: (chars) => {
        chars.landwalk = [...chars.landwalk, "Forest"];
      },
    },
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Elf"),
      modify: (chars) => {
        chars.keywords.add("shroud");
      },
    },
  ],
};
