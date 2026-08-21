// `Ribbons of the Reikai` — "Draw a card for each Spirit you control."
// The subtype census draw, off the DERIVED type lines. D240.

import { RIBBONS_OF_THE_REIKAI } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RIBBONS_OF_THE_REIKAI, 'Draw a card for each Spirit you control.');

export const RIBBONS_OF_THE_REIKAI_SCRIPT: CardScript = {
  oracleId: RIBBONS_OF_THE_REIKAI.oracleId,
  name: RIBBONS_OF_THE_REIKAI.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Spirit')) n++;
      }
      if (n <= 0) return [];
      return [...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
