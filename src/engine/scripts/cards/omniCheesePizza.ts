// `Omni-Cheese Pizza` - a etb trigger draw, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OMNI_CHEESE_PIZZA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OMNI_CHEESE_PIZZA, "When this artifact enters, draw a card.\n{1}, {T}, Sacrifice this artifact: Add one mana of any color.\n{2}, {T}, Sacrifice this artifact: You gain 3 life.");
const LINES = PRINTED.split('\n');

export const OMNI_CHEESE_PIZZA_SCRIPT: CardScript = {
  oracleId: OMNI_CHEESE_PIZZA.oracleId,
  name: OMNI_CHEESE_PIZZA.name,
  activated: [
    {
      ref: `${OMNI_CHEESE_PIZZA.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Omni-Cheese Pizza - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
