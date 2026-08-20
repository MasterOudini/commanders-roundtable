// `Natural Obsolescence` — "Put target artifact on the bottom of its
// owner's library." Mystic Repeal's artifact twin. D227.

import { NATURAL_OBSOLESCENCE } from '../../../data/fixtures/engineCards';
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
  NATURAL_OBSOLESCENCE,
  "Put target artifact on the bottom of its owner's library.",
);

export const NATURAL_OBSOLESCENCE_SCRIPT: CardScript = {
  oracleId: NATURAL_OBSOLESCENCE.oracleId,
  name: NATURAL_OBSOLESCENCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'library', player: card.owner },
              placement: 'bottom',
            },
          ],
        },
      ];
    },
  },
};
