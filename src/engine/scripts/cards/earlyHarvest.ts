// `Early Harvest` — "Target player untaps all basic lands they control."
// The BASIC supertype and the Land type both read derived; only the
// actually-tapped go in the event. D210.

import { EARLY_HARVEST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(EARLY_HARVEST, 'Target player untaps all basic lands they control.');

export const EARLY_HARVEST_SCRIPT: CardScript = {
  oracleId: EARLY_HARVEST.oracleId,
  name: EARLY_HARVEST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      if (ctx.state.players[target.id]?.hasLost) return [];
      const cards = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id || !card.tapped) continue;
        const tl = ctx.derive(id).typeLine;
        if (!tl.types.includes('Land') || !tl.supertypes.includes('Basic')) continue;
        cards.push(id);
      }
      if (cards.length === 0) return [];
      return [{ t: 'PermanentsUntapped', cards }];
    },
  },
};
