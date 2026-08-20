// `Dark Deal` — "Each player discards all the cards in their hand, then
// draws that many cards minus one." Wheel of Fortune's shape with the
// per-player count taken BEFORE the moves — "that many" is each player's
// own pre-discard hand size. D206.

import { DARK_DEAL } from '../../../data/fixtures/engineCards';
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
  DARK_DEAL,
  'Each player discards all the cards in their hand, then draws that many cards minus one.',
);

export const DARK_DEAL_SCRIPT: CardScript = {
  oracleId: DARK_DEAL.oracleId,
  name: DARK_DEAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const counts = new Map<string, number>();
      const moves = [];
      for (const pid of ctx.state.seating) {
        if (ctx.state.players[pid]?.hasLost) continue;
        const hand = ctx.state.zones.hand[pid] ?? [];
        counts.set(pid, hand.length);
        for (const id of hand) {
          moves.push({
            card: id,
            from: { kind: 'hand' as const, player: pid },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? pid },
          });
        }
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      for (const pid of ctx.state.seating) {
        if (ctx.state.players[pid]?.hasLost) continue;
        const n = (counts.get(pid) ?? 0) - 1;
        if (n > 0) events.push(...drawEvents(ctx.state, pid, n));
      }
      return events;
    },
  },
};
