// `Corrupted Conscience` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORRUPTED_CONSCIENCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORRUPTED_CONSCIENCE, "Enchant creature\nYou control enchanted creature.\nEnchanted creature has infect. (It deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)");
const LINES = PRINTED.split('\n');

export const CORRUPTED_CONSCIENCE_SCRIPT: CardScript = {
  oracleId: CORRUPTED_CONSCIENCE.oracleId,
  name: CORRUPTED_CONSCIENCE.name,
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("infect");
      },
    },
  ],
};
