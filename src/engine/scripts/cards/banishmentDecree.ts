// `Banishment Decree` — "Put target artifact, creature, or enchantment on
// top of its owner's library." The D199 noun-list widening's second card,
// on Anchor to the Aether's top-of-library move. D199.

import { BANISHMENT_DECREE } from '../../../data/fixtures/engineCards';
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
  BANISHMENT_DECREE,
  "Put target artifact, creature, or enchantment on top of its owner's library.",
);

export const BANISHMENT_DECREE_SCRIPT: CardScript = {
  oracleId: BANISHMENT_DECREE.oracleId,
  name: BANISHMENT_DECREE.name,
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
              placement: 'top',
            },
          ],
        },
      ];
    },
  },
};
