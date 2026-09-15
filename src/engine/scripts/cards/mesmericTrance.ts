// `Mesmeric Trance` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MESMERIC_TRANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MESMERIC_TRANCE, "Cumulative upkeep {1} (At the beginning of your upkeep, put an age counter on this permanent, then sacrifice it unless you pay its upkeep cost for each age counter on it.)\n{U}, Discard a card: Draw a card.");
const LINES = PRINTED.split('\n');

export const MESMERIC_TRANCE_SCRIPT: CardScript = {
  oracleId: MESMERIC_TRANCE.oracleId,
  name: MESMERIC_TRANCE.name,
  activated: [
    {
      ref: `${MESMERIC_TRANCE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
