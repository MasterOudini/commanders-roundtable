// `Windfall` — each player discards their HAND, then each draws the GREATEST
// number any ONE player discarded.
//
// ⚠️ The count is taken from the hands BEFORE the discards, because a resolve
// cannot see its own effects (D260/D264/D266/D268 — fifth outing). Every draw
// goes through the one draw rule so an empty library still loses correctly.
// D269.

import { WINDFALL } from '../../../data/fixtures/engineCards';
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
  WINDFALL,
  'Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.',
);

export const WINDFALL_SCRIPT: CardScript = {
  oracleId: WINDFALL.oracleId,
  name: WINDFALL.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const events: EventBody[] = [];
      const moves = [];
      let greatest = 0;

      // ⚠️ Read every hand FIRST: the discards below would hide the counts.
      for (const p of ctx.state.seating) {
        const player = ctx.state.players[p];
        if (!player || player.hasLost) continue;
        const hand = ctx.state.zones.hand[p] ?? [];
        if (hand.length > greatest) greatest = hand.length;
        for (const id of hand) {
          const card = ctx.state.cards[id];
          if (!card) continue;
          moves.push({
            card: id,
            from: { kind: 'hand' as const, player: p },
            to: { kind: 'graveyard' as const, player: card.owner },
          });
        }
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      if (greatest === 0) return events;

      for (const p of ctx.state.seating) {
        const player = ctx.state.players[p];
        if (!player || player.hasLost) continue;
        events.push(...drawEvents(ctx.state, p, greatest));
      }
      return events;
    },
  },
};
