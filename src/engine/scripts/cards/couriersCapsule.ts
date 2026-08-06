// `Courier's Capsule` — "{1}{U}, {T}, Sacrifice this artifact: Draw two
// cards." D159's self-sacrifice price with the Locket lesson attached: "draw
// two" is ONE CardsMoved of two moves (D163). M6.4l, D169.

import { COURIER_S_CAPSULE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(COURIER_S_CAPSULE, '{1}{U}, {T}, Sacrifice this artifact: Draw two cards.');

export const COURIERS_CAPSULE_SCRIPT: CardScript = {
  oracleId: COURIER_S_CAPSULE.oracleId,
  name: COURIER_S_CAPSULE.name,
  activated: [
    {
      ref: `${COURIER_S_CAPSULE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
