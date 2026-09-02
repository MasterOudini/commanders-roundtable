// `Words of Wisdom` — I draw two, each OTHER player draws one. Every draw
// through the one draw rule, in seating order, so an empty library still
// loses correctly (D158/D189). D270.

import { WORDS_OF_WISDOM } from '../../../data/fixtures/engineCards';
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
  WORDS_OF_WISDOM,
  'You draw two cards, then each other player draws a card.',
);

export const WORDS_OF_WISDOM_SCRIPT: CardScript = {
  oracleId: WORDS_OF_WISDOM.oracleId,
  name: WORDS_OF_WISDOM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 2)];
      for (const p of ctx.state.seating) {
        if (p === obj.controller) continue;
        const player = ctx.state.players[p];
        if (!player || player.hasLost) continue;
        events.push(...drawEvents(ctx.state, p, 1));
      }
      return events;
    },
  },
};
