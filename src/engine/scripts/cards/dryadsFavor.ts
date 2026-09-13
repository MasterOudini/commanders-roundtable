// `Dryad's Favor` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRYAD_S_FAVOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRYAD_S_FAVOR, "Enchant creature\nEnchanted creature has forestwalk. (It can't be blocked as long as defending player controls a Forest.)");
const LINES = PRINTED.split('\n');

export const DRYADS_FAVOR_SCRIPT: CardScript = {
  oracleId: DRYAD_S_FAVOR.oracleId,
  name: DRYAD_S_FAVOR.name,
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.landwalk = [...chars.landwalk, "Forest"];
      },
    },
  ],
};
