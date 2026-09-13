// `Malakir Soothsayer` - an activation drawLose
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MALAKIR_SOOTHSAYER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MALAKIR_SOOTHSAYER, "Cohort — {T}, Tap an untapped Ally you control: You draw a card and you lose 1 life.");

export const MALAKIR_SOOTHSAYER_SCRIPT: CardScript = {
  oracleId: MALAKIR_SOOTHSAYER.oracleId,
  name: MALAKIR_SOOTHSAYER.name,
  activated: [
    {
      ref: `${MALAKIR_SOOTHSAYER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
