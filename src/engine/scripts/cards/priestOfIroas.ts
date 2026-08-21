// `Priest of Iroas` — "{3}{W}, Sacrifice this creature: Destroy target
// enchantment." The self-sacrifice paying an enchantment kill. D235.

import { PRIEST_OF_IROAS } from '../../../data/fixtures/engineCards';
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
  PRIEST_OF_IROAS,
  '{3}{W}, Sacrifice this creature: Destroy target enchantment.',
);

export const PRIEST_OF_IROAS_SCRIPT: CardScript = {
  oracleId: PRIEST_OF_IROAS.oracleId,
  name: PRIEST_OF_IROAS.name,
  activated: [
    {
      ref: `${PRIEST_OF_IROAS.oracleId}#a0`,
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
