// `One with Nothing` — "Discard your hand." The choiceless whole-hand
// discard (the wheel precedent — no ask when everything goes). D230.

import { ONE_WITH_NOTHING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ONE_WITH_NOTHING, 'Discard your hand.');

export const ONE_WITH_NOTHING_SCRIPT: CardScript = {
  oracleId: ONE_WITH_NOTHING.oracleId,
  name: ONE_WITH_NOTHING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const hand = ctx.state.zones.hand[obj.controller] ?? [];
      if (hand.length === 0) return [];
      return [
        {
          t: 'CardsMoved',
          moves: hand.map((id) => ({
            card: id,
            from: { kind: 'hand' as const, player: obj.controller },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? obj.controller },
          })),
        },
      ];
    },
  },
};
