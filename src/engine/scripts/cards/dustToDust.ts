// `Dust to Dust` — "Exile two target artifacts." Probed: ONE spec of
// min 2 / max 2, so the intent carries both picks; each is re-checked and
// exiled (no indestructible gate — exile is not destroy). D209.

import { DUST_TO_DUST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DUST_TO_DUST, 'Exile two target artifacts.');

export const DUST_TO_DUST_SCRIPT: CardScript = {
  oracleId: DUST_TO_DUST.oracleId,
  name: DUST_TO_DUST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      const seen = new Set<string>();
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card' || seen.has(target.id)) continue;
        seen.add(target.id);
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
