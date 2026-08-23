// `Tolarian Winds` — the wheel WITHOUT a shuffle, which is exactly why it
// lands where D260's three did not: Time Reversal, Time Spiral and Timetwister
// each shuffle a hand and graveyard back into a library, and a shuffle needs a
// PERMUTATION, which needs `ctx.random` (still a stub). This one only discards
// and draws, so it is ordinary machinery.
//
// ⚠️ The discard is CHOICELESS (CR 701.8a) — the card says "all the cards",
// so no prompt is raised however big the hand is (D230's One with Nothing).
// ⚠️ The Winds themselves are ON THE STACK while this resolves, so they are
// not in the hand and are not discarded. The count is taken BEFORE the moves.
// ⚠️ D260s ordering trap does NOT bite here: the draw reads the LIBRARY,
// which the discard never touches, so computing both off the pre-resolution
// state is correct rather than convenient.
// D261.

import { TOLARIAN_WINDS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(TOLARIAN_WINDS, 'Discard all the cards in your hand, then draw that many cards.');

export const TOLARIAN_WINDS_SCRIPT: CardScript = {
  oracleId: TOLARIAN_WINDS.oracleId,
  name: TOLARIAN_WINDS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const hand = ctx.state.zones.hand[obj.controller] ?? [];
      const n = hand.length;
      if (n === 0) return [];
      const moves = hand.map((card: InstanceId) => ({
        card,
        from: { kind: 'hand' as const, player: obj.controller },
        to: { kind: 'graveyard' as const, player: ctx.state.cards[card]?.owner ?? obj.controller },
      }));
      return [{ t: 'CardsMoved', moves }, ...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
