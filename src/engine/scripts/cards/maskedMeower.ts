// `Masked Meower` — Haste is the engine's; a discarded card of my choice
// (D286) AND the Meower itself, both in the cost batch, buy a card.

import { MASKED_MEOWER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MASKED_MEOWER, 'Haste\nDiscard a card, Sacrifice this creature: Draw a card.');
const DRAW = PRINTED.split('\n')[1] as string;

export const MASKED_MEOWER_SCRIPT: CardScript = {
  oracleId: MASKED_MEOWER.oracleId,
  name: MASKED_MEOWER.name,
  activated: [
    {
      ref: `${MASKED_MEOWER.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
