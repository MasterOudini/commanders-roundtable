// `Reduce to Dreams` — "Return all artifacts and enchantments to their
// owners' hands." The two-type bounce-wipe. D238.

import { REDUCE_TO_DREAMS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(REDUCE_TO_DREAMS, "Return all artifacts and enchantments to their owners' hands.");

export const REDUCE_TO_DREAMS_SCRIPT: CardScript = {
  oracleId: REDUCE_TO_DREAMS.oracleId,
  name: REDUCE_TO_DREAMS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const types = ctx.derive(id).typeLine.types;
        if (!types.includes('Artifact') && !types.includes('Enchantment')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      return moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
    },
  },
};
