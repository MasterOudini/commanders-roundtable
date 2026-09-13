// `Cursed Flesh` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CURSED_FLESH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CURSED_FLESH, "Enchant creature\nEnchanted creature gets -1/-1 and has fear. (It can't be blocked except by artifact creatures and/or black creatures.)");
const LINES = PRINTED.split('\n');

export const CURSED_FLESH_SCRIPT: CardScript = {
  oracleId: CURSED_FLESH.oracleId,
  name: CURSED_FLESH.name,
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += -1;
        if (chars.toughness !== null) chars.toughness += -1;
      },
    },
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("fear");
      },
    },
  ],
};
