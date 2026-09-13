// `Volcanic Strength` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOLCANIC_STRENGTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOLCANIC_STRENGTH, "Enchant creature\nEnchanted creature gets +2/+2 and has mountainwalk. (It can't be blocked as long as defending player controls a Mountain.)");
const LINES = PRINTED.split('\n');

export const VOLCANIC_STRENGTH_SCRIPT: CardScript = {
  oracleId: VOLCANIC_STRENGTH.oracleId,
  name: VOLCANIC_STRENGTH.name,
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.landwalk = [...chars.landwalk, "Mountain"];
      },
    },
  ],
};
