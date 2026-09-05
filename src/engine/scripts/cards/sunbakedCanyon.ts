// `Sunbaked Canyon` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNBAKED_CANYON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNBAKED_CANYON, "{T}, Pay 1 life: Add {R} or {W}.\n{1}, {T}, Sacrifice this land: Draw a card.");
const LINES = PRINTED.split('\n');

export const SUNBAKED_CANYON_SCRIPT: CardScript = {
  oracleId: SUNBAKED_CANYON.oracleId,
  name: SUNBAKED_CANYON.name,
  activated: [
    {
      ref: `${SUNBAKED_CANYON.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
