// `Heartwarming Redemption` — discard the whole hand, draw n+1, gain
// n+1: the wheel arithmetic where every count is knowable up front (the
// hand after resolving is exactly the cards just drawn). D217.

import { HEARTWARMING_REDEMPTION } from '../../../data/fixtures/engineCards';
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
  HEARTWARMING_REDEMPTION,
  'Discard all the cards in your hand, then draw that many cards plus one. You gain life equal to the number of cards in your hand.',
);

export const HEARTWARMING_REDEMPTION_SCRIPT: CardScript = {
  oracleId: HEARTWARMING_REDEMPTION.oracleId,
  name: HEARTWARMING_REDEMPTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const hand = ctx.state.zones.hand[obj.controller] ?? [];
      const n = hand.length;
      const events: EventBody[] = [];
      if (n > 0) {
        events.push({
          t: 'CardsMoved',
          moves: hand.map((card) => ({
            card,
            from: { kind: 'hand' as const, player: obj.controller },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[card]?.owner ?? obj.controller },
          })),
        });
      }
      events.push(...drawEvents(ctx.state, obj.controller, n + 1));
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: n + 1, to: me.life + n + 1 });
      }
      return events;
    },
  },
};
