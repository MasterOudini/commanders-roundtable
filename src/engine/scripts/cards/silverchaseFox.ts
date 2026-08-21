// `Silverchase Fox` — "{1}{W}, Sacrifice this creature: Exile target
// enchantment." The self-sac priced EXILE — no indestructible check, an
// exile is not destruction. D247.

import { SILVERCHASE_FOX } from '../../../data/fixtures/engineCards';
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
  SILVERCHASE_FOX,
  '{1}{W}, Sacrifice this creature: Exile target enchantment.',
);

export const SILVERCHASE_FOX_SCRIPT: CardScript = {
  oracleId: SILVERCHASE_FOX.oracleId,
  name: SILVERCHASE_FOX.name,
  activated: [
    {
      ref: `${SILVERCHASE_FOX.oracleId}#a0`,
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
                to: { kind: 'exile', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
