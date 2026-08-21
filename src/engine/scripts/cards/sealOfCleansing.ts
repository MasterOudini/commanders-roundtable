// `Seal of Cleansing` — "Sacrifice this enchantment: Destroy target
// artifact or enchantment." The Seal cycle's removal half; its exact
// text lands beside Seal of Primordium in the SAME batch. D244.

import { SEAL_OF_CLEANSING } from '../../../data/fixtures/engineCards';
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
  SEAL_OF_CLEANSING,
  'Sacrifice this enchantment: Destroy target artifact or enchantment.',
);

export const SEAL_OF_CLEANSING_SCRIPT: CardScript = {
  oracleId: SEAL_OF_CLEANSING.oracleId,
  name: SEAL_OF_CLEANSING.name,
  activated: [
    {
      ref: `${SEAL_OF_CLEANSING.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
