// `Aether Tradewinds` — "Return target permanent you control and target
// permanent you don't control to their owners' hands." Two clauses, two
// targets (the parse premise probed before drafting), each bounced to its
// OWNER, each independently zone-checked (CR 608.2b does what it can when
// one is gone). D197.

import { AETHER_TRADEWINDS } from '../../../data/fixtures/engineCards';
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
  AETHER_TRADEWINDS,
  "Return target permanent you control and target permanent you don't control to their owners' hands.",
);

export const AETHER_TRADEWINDS_SCRIPT: CardScript = {
  oracleId: AETHER_TRADEWINDS.oracleId,
  name: AETHER_TRADEWINDS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
