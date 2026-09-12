// `Lashknife` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LASHKNIFE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LASHKNIFE, "If you control a Plains, you may tap an untapped creature you control rather than pay this spell's mana cost.\nEnchant creature\nEnchanted creature has first strike.");
const LINES = PRINTED.split('\n');

export const LASHKNIFE_SCRIPT: CardScript = {
  oracleId: LASHKNIFE.oracleId,
  name: LASHKNIFE.name,
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
