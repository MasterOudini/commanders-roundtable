// `Waterlogged Grove` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WATERLOGGED_GROVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WATERLOGGED_GROVE, "{T}, Pay 1 life: Add {G} or {U}.\n{1}, {T}, Sacrifice this land: Draw a card.");
const LINES = PRINTED.split('\n');

export const WATERLOGGED_GROVE_SCRIPT: CardScript = {
  oracleId: WATERLOGGED_GROVE.oracleId,
  name: WATERLOGGED_GROVE.name,
  activated: [
    {
      ref: `${WATERLOGGED_GROVE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
