// `Unbridled Growth` - a static attachedStatic, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNBRIDLED_GROWTH } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { grantedMana, pushGrantedMana } from '../grants';
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

const PRINTED = printed(UNBRIDLED_GROWTH, "Enchant land\nEnchanted land has \"{T}: Add one mana of any color.\"\nSacrifice this Aura: Draw a card.");
const LINES = PRINTED.split('\n');

const GRANT_1 = grantedMana("{T}: Add one mana of any color.", UNBRIDLED_GROWTH.name);

export const UNBRIDLED_GROWTH_SCRIPT: CardScript = {
  oracleId: UNBRIDLED_GROWTH.oracleId,
  name: UNBRIDLED_GROWTH.name,
  activated: [
    {
      ref: `${UNBRIDLED_GROWTH.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        pushGrantedMana(chars, GRANT_1);
      },
    },
  ],
};
