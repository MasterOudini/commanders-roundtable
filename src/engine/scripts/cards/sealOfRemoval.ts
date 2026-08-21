// `Seal of Removal` — "Sacrifice this enchantment: Return target
// creature to its owner's hand." The Seal cycle's bounce. D244.

import { SEAL_OF_REMOVAL } from '../../../data/fixtures/engineCards';
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
  SEAL_OF_REMOVAL,
  "Sacrifice this enchantment: Return target creature to its owner's hand.",
);

export const SEAL_OF_REMOVAL_SCRIPT: CardScript = {
  oracleId: SEAL_OF_REMOVAL.oracleId,
  name: SEAL_OF_REMOVAL.name,
  activated: [
    {
      ref: `${SEAL_OF_REMOVAL.oracleId}#a0`,
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
  ],
};
