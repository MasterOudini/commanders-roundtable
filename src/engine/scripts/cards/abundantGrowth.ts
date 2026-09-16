// `Abundant Growth` - a etb trigger draw, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABUNDANT_GROWTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABUNDANT_GROWTH, "Enchant land\nWhen this Aura enters, draw a card.\nEnchanted land has \"{T}: Add one mana of any color.\"");
const LINES = PRINTED.split('\n');

const GRANT_2 = grantedMana("{T}: Add one mana of any color.", ABUNDANT_GROWTH.name);

export const ABUNDANT_GROWTH_SCRIPT: CardScript = {
  oracleId: ABUNDANT_GROWTH.oracleId,
  name: ABUNDANT_GROWTH.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Abundant Growth - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        pushGrantedMana(chars, GRANT_2);
      },
    },
  ],
};
