// `Caustic Caterpillar` — "{1}{G}, Sacrifice this creature: Destroy target
// artifact or enchantment." Capashen Unicorn's shape. M6.4i, D166.

import { CAUSTIC_CATERPILLAR } from '../../../data/fixtures/engineCards';
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
  CAUSTIC_CATERPILLAR,
  '{1}{G}, Sacrifice this creature: Destroy target artifact or enchantment.',
);

export const CAUSTIC_CATERPILLAR_SCRIPT: CardScript = {
  oracleId: CAUSTIC_CATERPILLAR.oracleId,
  name: CAUSTIC_CATERPILLAR.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${CAUSTIC_CATERPILLAR.oracleId}#a0`,
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
