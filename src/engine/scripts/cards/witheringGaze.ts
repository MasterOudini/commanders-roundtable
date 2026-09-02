// `Withering Gaze` — reveal the opponent's hand, then draw one card per
// FOREST and per GREEN card in it.
//
// ⚠️ "and", not "or": a GREEN FOREST counts TWICE, once in each term. That is
// the same reading D267's War Report needed ("creatures PLUS artifacts"), and
// it is the branch worth pinning — a card that treats it as a union passes a
// naive test just as well.
//
// The reveal is a real `CardsRevealed` to me, so the count is auditable from
// the log rather than asserted out of nowhere. D270.

import { WITHERING_GAZE } from '../../../data/fixtures/engineCards';
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
  WITHERING_GAZE,
  'Target opponent reveals their hand. You draw a card for each Forest and green card in it.',
);

export const WITHERING_GAZE_SCRIPT: CardScript = {
  oracleId: WITHERING_GAZE.oracleId,
  name: WITHERING_GAZE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const victim = ctx.state.players[target.id];
      if (!victim || victim.hasLost) return [];

      const hand = ctx.state.zones.hand[target.id] ?? [];
      const events: EventBody[] = [];
      if (hand.length > 0) {
        events.push({ t: 'CardsRevealed', cards: [...hand], to: [obj.controller] });
      }

      let n = 0;
      for (const id of hand) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        // ⚠️ Both terms, independently — a green Forest scores 2.
        if (d.typeLine.subtypes.includes('Forest')) n += 1;
        if (d.colors.includes('G')) n += 1;
      }
      if (n === 0) return events;

      events.push(...drawEvents(ctx.state, obj.controller, n));
      return events;
    },
  },
};
