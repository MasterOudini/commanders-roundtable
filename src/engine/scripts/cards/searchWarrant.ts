// `Search Warrant` — "Target player reveals their hand. You gain life
// equal to the number of cards in that player's hand." The public
// reveal plus the census gain. D244.

import { SEARCH_WARRANT } from '../../../data/fixtures/engineCards';
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
  SEARCH_WARRANT,
  "Target player reveals their hand. You gain life equal to the number of cards in that player's hand.",
);

export const SEARCH_WARRANT_SCRIPT: CardScript = {
  oracleId: SEARCH_WARRANT.oracleId,
  name: SEARCH_WARRANT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const hand = ctx.state.zones.hand[target.id] ?? [];
      const events: EventBody[] = [];
      if (hand.length > 0) {
        events.push({ t: 'CardsRevealed', cards: [...hand], to: ctx.state.seating });
      }
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost && hand.length > 0) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: hand.length,
          to: me.life + hand.length,
        });
      }
      return events;
    },
  },
};
