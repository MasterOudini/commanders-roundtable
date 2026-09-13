// `Leshrac's Rite` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LESHRAC_S_RITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LESHRAC_S_RITE, "Enchant creature\nEnchanted creature has swampwalk. (It can't be blocked as long as defending player controls a Swamp.)");
const LINES = PRINTED.split('\n');

export const LESHRACS_RITE_SCRIPT: CardScript = {
  oracleId: LESHRAC_S_RITE.oracleId,
  name: LESHRAC_S_RITE.name,
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.landwalk = [...chars.landwalk, "Swamp"];
      },
    },
  ],
};
