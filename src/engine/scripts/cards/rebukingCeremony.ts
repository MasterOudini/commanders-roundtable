// `Rebuking Ceremony` — "Put two target artifacts on top of their
// owners' libraries." Plow Under one noun over. D238.

import { REBUKING_CEREMONY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(REBUKING_CEREMONY, "Put two target artifacts on top of their owners' libraries.");

export const REBUKING_CEREMONY_SCRIPT: CardScript = {
  oracleId: REBUKING_CEREMONY.oracleId,
  name: REBUKING_CEREMONY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'library' as const, player: card.owner },
          placement: 'top' as const,
        });
      }
      return moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
    },
  },
};
