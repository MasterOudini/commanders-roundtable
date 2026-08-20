// `Harmonic Convergence` — every enchantment goes on TOP of its owner's
// library: Hallowed Burial's move at the other end. D217.

import { HARMONIC_CONVERGENCE } from '../../../data/fixtures/engineCards';
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
  HARMONIC_CONVERGENCE,
  "Put all enchantments on top of their owners' libraries.",
);

export const HARMONIC_CONVERGENCE_SCRIPT: CardScript = {
  oracleId: HARMONIC_CONVERGENCE.oracleId,
  name: HARMONIC_CONVERGENCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Enchantment')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'library' as const, player: card.owner },
          placement: 'top' as const,
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
