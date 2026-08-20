// `Frantic Inventory` — "Draw a card, then draw cards equal to the number
// of cards named Frantic Inventory in your graveyard." The self-name
// census over MY graveyard alone. D215.

import { FRANTIC_INVENTORY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  FRANTIC_INVENTORY,
  'Draw a card, then draw cards equal to the number of cards named Frantic Inventory in your graveyard.',
);

export const FRANTIC_INVENTORY_SCRIPT: CardScript = {
  oracleId: FRANTIC_INVENTORY.oracleId,
  name: FRANTIC_INVENTORY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let named = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (ctx.oracle.byPrinting(card.printingId)?.name === 'Frantic Inventory') named++;
      }
      return [...drawEvents(ctx.state, obj.controller, 1 + named)];
    },
  },
};
