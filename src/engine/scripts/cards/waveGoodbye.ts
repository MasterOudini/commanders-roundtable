// `Wave Goodbye` — "Return each creature WITHOUT a +1/+1 counter on it to its
// owner's hand." A negated COUNTER predicate, board-wide and any controller,
// so a counter is the only thing that saves a creature — mine included.
// D268.

import { WAVE_GOODBYE } from '../../../data/fixtures/engineCards';
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
  WAVE_GOODBYE,
  "Return each creature without a +1/+1 counter on it to its owner's hand.",
);

export const WAVE_GOODBYE_SCRIPT: CardScript = {
  oracleId: WAVE_GOODBYE.oracleId,
  name: WAVE_GOODBYE.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        if ((card.counters['+1/+1'] ?? 0) > 0) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
