// `Flow of Ideas` — "Draw a card for each Island you control." D214.

import { FLOW_OF_IDEAS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FLOW_OF_IDEAS, 'Draw a card for each Island you control.');

export const FLOW_OF_IDEAS_SCRIPT: CardScript = {
  oracleId: FLOW_OF_IDEAS.oracleId,
  name: FLOW_OF_IDEAS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Island')) n++;
      }
      if (n === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
