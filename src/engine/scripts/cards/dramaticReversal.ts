// `Dramatic Reversal` — "Untap all nonland permanents you control." Only
// the actually-tapped go in the event, so it says only what changed. D209.

import { DRAMATIC_REVERSAL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DRAMATIC_REVERSAL, 'Untap all nonland permanents you control.');

export const DRAMATIC_REVERSAL_SCRIPT: CardScript = {
  oracleId: DRAMATIC_REVERSAL.oracleId,
  name: DRAMATIC_REVERSAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const cards = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller || !card.tapped) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) continue;
        cards.push(id);
      }
      if (cards.length === 0) return [];
      return [{ t: 'PermanentsUntapped', cards }];
    },
  },
};
