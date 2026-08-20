// `Collective Unconscious` — "Draw a card for each creature you control."
// D204.

import { COLLECTIVE_UNCONSCIOUS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(COLLECTIVE_UNCONSCIOUS, 'Draw a card for each creature you control.');

export const COLLECTIVE_UNCONSCIOUS_SCRIPT: CardScript = {
  oracleId: COLLECTIVE_UNCONSCIOUS.oracleId,
  name: COLLECTIVE_UNCONSCIOUS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Creature')) n++;
      }
      if (n === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
