// `Oread of Mountain's Blaze` — three mana and a discarded card of my choice
// (D286) buy a card.

import { OREAD_OF_MOUNTAIN_S_BLAZE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(OREAD_OF_MOUNTAIN_S_BLAZE, '{2}{R}, Discard a card: Draw a card.');

export const OREAD_OF_MOUNTAINS_BLAZE_SCRIPT: CardScript = {
  oracleId: OREAD_OF_MOUNTAIN_S_BLAZE.oracleId,
  name: OREAD_OF_MOUNTAIN_S_BLAZE.name,
  activated: [
    {
      ref: `${OREAD_OF_MOUNTAIN_S_BLAZE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
