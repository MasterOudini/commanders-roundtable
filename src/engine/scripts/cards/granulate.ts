// `Granulate` — "Destroy each nonland artifact with mana value 4 or
// less." Gaze of Granite's sweep with the number printed. D216.

import { GRANULATE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GRANULATE, 'Destroy each nonland artifact with mana value 4 or less.');

export const GRANULATE_SCRIPT: CardScript = {
  oracleId: GRANULATE.oracleId,
  name: GRANULATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Artifact')) continue;
        if (d.typeLine.types.includes('Land')) continue;
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        if (mv > 4) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
