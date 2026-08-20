// `Grim Flowering` — "Draw a card for each creature card in your
// graveyard." Ghoul's Feast's census feeding the draw rule. D216.

import { GRIM_FLOWERING } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { faceOf } from '../../oracle';
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

const TEXT = printed(GRIM_FLOWERING, 'Draw a card for each creature card in your graveyard.');

export const GRIM_FLOWERING_SCRIPT: CardScript = {
  oracleId: GRIM_FLOWERING.oracleId,
  name: GRIM_FLOWERING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        if (faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Creature')) n++;
      }
      if (n === 0) return [];
      return drawEvents(ctx.state, obj.controller, n);
    },
  },
};
