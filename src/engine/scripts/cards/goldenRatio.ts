// `Golden Ratio` — "Draw a card for each different power among creatures
// you control." The census is a SET of derived powers. D216.

import { GOLDEN_RATIO } from '../../../data/fixtures/engineCards';
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
  GOLDEN_RATIO,
  'Draw a card for each different power among creatures you control.',
);

export const GOLDEN_RATIO_SCRIPT: CardScript = {
  oracleId: GOLDEN_RATIO.oracleId,
  name: GOLDEN_RATIO.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const powers = new Set<number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        powers.add(d.power ?? 0);
      }
      if (powers.size === 0) return [];
      return drawEvents(ctx.state, obj.controller, powers.size);
    },
  },
};
