// `Reinforcements` — up to three target creature cards from my graveyard go
// on top of my library, in the order they were named (the last named ends
// up on top).

import { REINFORCEMENTS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(REINFORCEMENTS, 'Put up to three target creature cards from your graveyard on top of your library.');

export const REINFORCEMENTS_SCRIPT: CardScript = {
  oracleId: REINFORCEMENTS.oracleId,
  name: REINFORCEMENTS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') continue;
        moves.push({
          card: target.id,
          from: { kind: 'graveyard' as const, player: card.owner },
          to: { kind: 'library' as const, player: card.owner },
          placement: 'top' as const,
        });
      }
      return moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
    },
  },
};
