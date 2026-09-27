// `Mogis's Favor` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOGIS_S_FAVOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOGIS_S_FAVOR, "Enchant creature\nEnchanted creature gets +2/-1.\nEscape—{2}{B}, Exile two other cards from your graveyard. (You may cast this card from your graveyard for its escape cost.)");
const LINES = PRINTED.split('\n');

export const MOGISS_FAVOR_SCRIPT: CardScript = {
  oracleId: MOGIS_S_FAVOR.oracleId,
  name: MOGIS_S_FAVOR.name,
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += -1;
      },
    },
  ],
};
