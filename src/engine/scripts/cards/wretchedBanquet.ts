// `Wretched Banquet` — "Destroy target creature if it has the least power or
// is tied for least power among creatures on the battlefield."
//
// The condition is read at RESOLUTION over EVERY creature, both seats: the
// minimum power on the board, then the target dies only if its own power is
// at most that minimum (a tie counts, the card says so). A target that is not
// the smallest survives — the branch a happy-path test never sees. D271.

import { WRETCHED_BANQUET } from '../../../data/fixtures/engineCards';
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
  WRETCHED_BANQUET,
  'Destroy target creature if it has the least power or is tied for least power among creatures on the battlefield.',
);

export const WRETCHED_BANQUET_SCRIPT: CardScript = {
  oracleId: WRETCHED_BANQUET.oracleId,
  name: WRETCHED_BANQUET.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];

      let least = Infinity;
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        const p = d.power ?? 0;
        if (p < least) least = p;
      }
      const own = ctx.derive(target.id).power ?? 0;
      if (own > least) return [];
      if (ctx.derive(target.id).keywords.has('indestructible')) return [];

      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        },
      ];
    },
  },
};
