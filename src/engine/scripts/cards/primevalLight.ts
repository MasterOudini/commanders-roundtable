// `Primeval Light` — "Destroy all enchantments target player controls."
// The one-player typed wipe, aimed. D235.

import { PRIMEVAL_LIGHT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PRIMEVAL_LIGHT, 'Destroy all enchantments target player controls.');

export const PRIMEVAL_LIGHT_SCRIPT: CardScript = {
  oracleId: PRIMEVAL_LIGHT.oracleId,
  name: PRIMEVAL_LIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Enchantment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      return moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
    },
  },
};
