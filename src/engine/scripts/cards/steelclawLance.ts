// `Steelclaw Lance` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEELCLAW_LANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEELCLAW_LANCE, "Equipped creature gets +2/+2.\nEquip Knight {1}\nEquip {3}");
const LINES = PRINTED.split('\n');

export const STEELCLAW_LANCE_SCRIPT: CardScript = {
  oracleId: STEELCLAW_LANCE.oracleId,
  name: STEELCLAW_LANCE.name,
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
