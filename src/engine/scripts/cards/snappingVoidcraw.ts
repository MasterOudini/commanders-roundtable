// `Snapping Voidcraw` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SNAPPING_VOIDCRAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SNAPPING_VOIDCRAW, "Devoid (This card has no color.)\n{T}: Add {C}{C}.\n{3}{C}, {T}: Draw a card.");
const LINES = PRINTED.split('\n');

export const SNAPPING_VOIDCRAW_SCRIPT: CardScript = {
  oracleId: SNAPPING_VOIDCRAW.oracleId,
  name: SNAPPING_VOIDCRAW.name,
  activated: [
    {
      ref: `${SNAPPING_VOIDCRAW.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
