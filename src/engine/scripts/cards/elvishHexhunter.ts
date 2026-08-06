// `Elvish Hexhunter` — "{G/W}, {T}, Sacrifice this creature: Destroy target
// enchantment." Druid Lyrist's shape behind a HYBRID pip (Azorius Locket's
// payment problem at width one). M6.4q, D173.

import { ELVISH_HEXHUNTER } from '../../../data/fixtures/engineCards';
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
  ELVISH_HEXHUNTER,
  '{G/W}, {T}, Sacrifice this creature: Destroy target enchantment.',
);

export const ELVISH_HEXHUNTER_SCRIPT: CardScript = {
  oracleId: ELVISH_HEXHUNTER.oracleId,
  name: ELVISH_HEXHUNTER.name,
  activated: [
    {
      ref: `${ELVISH_HEXHUNTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b — an indestructible permanent is not destroyed.
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
