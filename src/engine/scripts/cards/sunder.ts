// `Sunder` — every land on the battlefield goes to its OWNER's hand, in
// one simultaneous move. D255.

import { SUNDER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardMove, EventBody } from '../../types/events';
import type { CardScript } from '../api';

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

const TEXT = printed(SUNDER, "Return all lands to their owners' hands.");

export const SUNDER_SCRIPT: CardScript = {
  oracleId: SUNDER.oracleId,
  name: SUNDER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves: CardMove[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Land')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'hand', player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
