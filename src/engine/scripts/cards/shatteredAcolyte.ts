// `Shattered Acolyte` — "Lifelink / {1}, Sacrifice this creature:
// Destroy target artifact or enchantment." The self-sac compound
// removal behind a keyword line. D246.

import { SHATTERED_ACOLYTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  SHATTERED_ACOLYTE,
  'Lifelink\n{1}, Sacrifice this creature: Destroy target artifact or enchantment.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SHATTERED_ACOLYTE_SCRIPT: CardScript = {
  oracleId: SHATTERED_ACOLYTE.oracleId,
  name: SHATTERED_ACOLYTE.name,
  activated: [
    {
      ref: `${SHATTERED_ACOLYTE.oracleId}#a0`,
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
