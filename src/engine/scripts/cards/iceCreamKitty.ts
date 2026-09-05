// `Ice Cream Kitty` - an activation draw, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICE_CREAM_KITTY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ICE_CREAM_KITTY, "{2}, Sacrifice another creature or token: Draw a card. Activate only as a sorcery.\n{2}, {T}, Sacrifice this creature: You gain 3 life.");
const LINES = PRINTED.split('\n');

export const ICE_CREAM_KITTY_SCRIPT: CardScript = {
  oracleId: ICE_CREAM_KITTY.oracleId,
  name: ICE_CREAM_KITTY.name,
  activated: [
    {
      ref: `${ICE_CREAM_KITTY.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      ref: `${ICE_CREAM_KITTY.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
};
