// `Rush of Knowledge` — "Draw cards equal to the greatest mana value
// among permanents you control." One with the Machine, one type wider.
// D242.

import { RUSH_OF_KNOWLEDGE } from '../../../data/fixtures/engineCards';
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
  RUSH_OF_KNOWLEDGE,
  'Draw cards equal to the greatest mana value among permanents you control.',
);

export const RUSH_OF_KNOWLEDGE_SCRIPT: CardScript = {
  oracleId: RUSH_OF_KNOWLEDGE.oracleId,
  name: RUSH_OF_KNOWLEDGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let greatest = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        if (mv > greatest) greatest = mv;
      }
      if (greatest === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, greatest)];
    },
  },
};
