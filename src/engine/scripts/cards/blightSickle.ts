// `Blight Sickle` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIGHT_SICKLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLIGHT_SICKLE, "Equipped creature gets +1/+0 and has wither. (It deals damage to creatures in the form of -1/-1 counters.)\nEquip {2}");
const LINES = PRINTED.split('\n');

export const BLIGHT_SICKLE_SCRIPT: CardScript = {
  oracleId: BLIGHT_SICKLE.oracleId,
  name: BLIGHT_SICKLE.name,
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("wither");
      },
    },
  ],
};
