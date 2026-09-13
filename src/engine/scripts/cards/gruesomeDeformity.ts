// `Gruesome Deformity` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRUESOME_DEFORMITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRUESOME_DEFORMITY, "Enchant creature\nEnchanted creature has intimidate. (It can't be blocked except by artifact creatures and/or creatures that share a color with it.)");
const LINES = PRINTED.split('\n');

export const GRUESOME_DEFORMITY_SCRIPT: CardScript = {
  oracleId: GRUESOME_DEFORMITY.oracleId,
  name: GRUESOME_DEFORMITY.name,
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("intimidate");
      },
    },
  ],
};
