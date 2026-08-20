// `Hoodwink` — "Return target artifact, enchantment, or land to its
// owner's hand." The Icy triple with LAND as the third member — the
// compound joins the family with this batch (probed missing). D218.

import { HOODWINK } from '../../../data/fixtures/engineCards';
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
  HOODWINK,
  "Return target artifact, enchantment, or land to its owner's hand.",
);

export const HOODWINK_SCRIPT: CardScript = {
  oracleId: HOODWINK.oracleId,
  name: HOODWINK.name,
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
              to: { kind: 'hand', player: card.owner },
            },
          ],
        },
      ];
    },
  },
};
