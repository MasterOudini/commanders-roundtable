// `Churning Eddy` — "Return target creature and target land to their
// owners' hands." Two specs, one bounce batch. D203.

import { CHURNING_EDDY } from '../../../data/fixtures/engineCards';
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
  CHURNING_EDDY,
  "Return target creature and target land to their owners' hands.",
);

export const CHURNING_EDDY_SCRIPT: CardScript = {
  oracleId: CHURNING_EDDY.oracleId,
  name: CHURNING_EDDY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const target of [obj.targets[0], obj.targets[1]]) {
        if (!target || target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
