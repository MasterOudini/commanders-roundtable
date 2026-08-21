// `Stern Dismissal` — the probed compound bounce: 'creature or enchantment
// an opponent controls' parses BOTH kinds with the opponent restriction
// ENFORCED, and the card goes to its OWNER's hand. D253.

import { STERN_DISMISSAL } from '../../../data/fixtures/engineCards';
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
  STERN_DISMISSAL,
  "Return target creature or enchantment an opponent controls to its owner's hand.",
);

export const STERN_DISMISSAL_SCRIPT: CardScript = {
  oracleId: STERN_DISMISSAL.oracleId,
  name: STERN_DISMISSAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'hand', player: card.owner },
            },
          ],
        },
      ];
    },
  },
};
