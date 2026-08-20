// `Plow Under` — "Put two target lands on top of their owners'
// libraries." Two specs in one clause (the counted machinery), each land
// to its OWN owner's library top. D234.

import { PLOW_UNDER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PLOW_UNDER, "Put two target lands on top of their owners' libraries.");

export const PLOW_UNDER_SCRIPT: CardScript = {
  oracleId: PLOW_UNDER.oracleId,
  name: PLOW_UNDER.name,
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
