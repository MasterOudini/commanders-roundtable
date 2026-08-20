// `Guan Yu's 1,000-Li March` — "Destroy all tapped creatures." The sweep
// filtered on the INSTANCE fact. D216.

import { GUAN_YU_S_1_000_LI_MARCH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GUAN_YU_S_1_000_LI_MARCH, 'Destroy all tapped creatures.');

export const GUAN_YUS_MARCH_SCRIPT: CardScript = {
  oracleId: GUAN_YU_S_1_000_LI_MARCH.oracleId,
  name: GUAN_YU_S_1_000_LI_MARCH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || !card.tapped) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
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
