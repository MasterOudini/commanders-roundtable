// `Hallowed Burial` — every creature goes to the BOTTOM of its owner's
// library: not destruction, so indestructible never enters into it. D216.

import { HALLOWED_BURIAL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HALLOWED_BURIAL, "Put all creatures on the bottom of their owners' libraries.");

export const HALLOWED_BURIAL_SCRIPT: CardScript = {
  oracleId: HALLOWED_BURIAL.oracleId,
  name: HALLOWED_BURIAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'library' as const, player: card.owner },
          placement: 'bottom' as const,
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
