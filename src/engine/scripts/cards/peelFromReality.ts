// `Peel from Reality` — "Return target creature you control and target
// creature you don't control to their owners' hands." The two-spec bounce
// (Bite Down's parse family), each to its OWNER. D232.

import { PEEL_FROM_REALITY } from '../../../data/fixtures/engineCards';
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
  PEEL_FROM_REALITY,
  "Return target creature you control and target creature you don't control to their owners' hands.",
);

export const PEEL_FROM_REALITY_SCRIPT: CardScript = {
  oracleId: PEEL_FROM_REALITY.oracleId,
  name: PEEL_FROM_REALITY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
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
