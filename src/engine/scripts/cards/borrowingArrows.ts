// `Borrowing 100,000 Arrows` — "Draw a card for each tapped creature target
// opponent controls." The count is TAPPED derived creatures of the target,
// through THE draw rule. D201.

import { BORROWING_100_000_ARROWS } from '../../../data/fixtures/engineCards';
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
  BORROWING_100_000_ARROWS,
  'Draw a card for each tapped creature target opponent controls.',
);

export const BORROWING_ARROWS_SCRIPT: CardScript = {
  oracleId: BORROWING_100_000_ARROWS.oracleId,
  name: BORROWING_100_000_ARROWS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id || !card.tapped) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        n++;
      }
      if (n === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
