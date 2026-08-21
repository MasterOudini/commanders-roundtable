// `Take Inventory` — Frantic Inventory's self-name census on a second id:
// one draw plus one per namesake already in the graveyard. The resolving
// copy is on the STACK, so it counts itself not. D256.

import { TAKE_INVENTORY } from '../../../data/fixtures/engineCards';
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
  TAKE_INVENTORY,
  'Draw a card, then draw cards equal to the number of cards named Take Inventory in your graveyard.',
);

export const TAKE_INVENTORY_SCRIPT: CardScript = {
  oracleId: TAKE_INVENTORY.oracleId,
  name: TAKE_INVENTORY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let namesakes = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (oc?.name === TAKE_INVENTORY.name) namesakes += 1;
      }
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [...drawEvents(ctx.state, obj.controller, 1 + namesakes)];
    },
  },
};
