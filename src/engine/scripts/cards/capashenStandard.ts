// `Capashen Standard` - a static attachedStatic, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPASHEN_STANDARD } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(CAPASHEN_STANDARD, "Enchant creature\nEnchanted creature gets +1/+1.\n{2}, Sacrifice this Aura: Draw a card.");
const LINES = PRINTED.split('\n');

export const CAPASHEN_STANDARD_SCRIPT: CardScript = {
  oracleId: CAPASHEN_STANDARD.oracleId,
  name: CAPASHEN_STANDARD.name,
  activated: [
    {
      ref: `${CAPASHEN_STANDARD.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
