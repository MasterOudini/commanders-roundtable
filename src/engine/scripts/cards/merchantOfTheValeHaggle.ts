// `Merchant of the Vale // Haggle` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MERCHANT_OF_THE_VALE_HAGGLE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(MERCHANT_OF_THE_VALE_HAGGLE, "{2}{R}, Discard a card: Draw a card.\nYou may discard a card. If you do, draw a card. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const MERCHANT_OF_THE_VALE_HAGGLE_SCRIPT: CardScript = {
  oracleId: MERCHANT_OF_THE_VALE_HAGGLE.oracleId,
  name: MERCHANT_OF_THE_VALE_HAGGLE.name,
  activated: [
    {
      ref: `${MERCHANT_OF_THE_VALE_HAGGLE.oracleId}#a0`, face: 0,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
