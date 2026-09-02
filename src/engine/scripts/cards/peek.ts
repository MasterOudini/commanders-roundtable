// `Peek` — "Look at target player's hand.\nDraw a card." Gitaxian Probe's
// reveal-to-me of the whole targeted hand (CardsRevealed to the caster
// alone, D61 keeps it private to them), then the draw. D278.

import { PEEK } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PEEK, "Look at target player's hand.\nDraw a card.");

export const PEEK_SCRIPT: CardScript = {
  oracleId: PEEK.oracleId,
  name: PEEK.name,
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
