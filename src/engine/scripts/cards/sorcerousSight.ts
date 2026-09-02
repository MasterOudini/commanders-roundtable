// `Sorcerous Sight` — "Look at target opponent's hand.\nDraw a card." Peek
// (D278) with the aim narrowed to an opponent: the whole targeted hand
// revealed to me alone, then the draw. D281.

import { SORCEROUS_SIGHT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SORCEROUS_SIGHT, "Look at target opponent's hand.\nDraw a card.");

export const SORCEROUS_SIGHT_SCRIPT: CardScript = {
  oracleId: SORCEROUS_SIGHT.oracleId,
  name: SORCEROUS_SIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const hand = ctx.state.zones.hand[target.id] ?? [];
      const events: EventBody[] = [];
      if (hand.length > 0) events.push({ t: 'CardsRevealed', cards: [...hand], to: [obj.controller] });
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
