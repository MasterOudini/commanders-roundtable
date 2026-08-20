// `Displacement Wave` — "Return all nonland permanents with mana value X or
// less to their owners' hands." A token bounced to a hand ceases (CR
// 704.5d — the reducer's job); the MV is the printing's (a battlefield
// permanent's X is spent, CR 202.3b makes it 0 there). D208.

import { DISPLACEMENT_WAVE } from '../../../data/fixtures/engineCards';
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
  DISPLACEMENT_WAVE,
  "Return all nonland permanents with mana value X or less to their owners' hands.",
);

export const DISPLACEMENT_WAVE_SCRIPT: CardScript = {
  oracleId: DISPLACEMENT_WAVE.oracleId,
  name: DISPLACEMENT_WAVE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) continue;
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        if (mv > x) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
