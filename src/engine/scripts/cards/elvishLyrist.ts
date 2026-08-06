// `Elvish Lyrist` — "{G}, {T}, Sacrifice this creature: Destroy target
// enchantment." Druid Lyrist's EXACT printed text on a second oracle id
// (Benalish Trapper's precedent, D164) — proven on its own. M6.4q, D173.

import { ELVISH_LYRIST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ELVISH_LYRIST, '{G}, {T}, Sacrifice this creature: Destroy target enchantment.');

export const ELVISH_LYRIST_SCRIPT: CardScript = {
  oracleId: ELVISH_LYRIST.oracleId,
  name: ELVISH_LYRIST.name,
  activated: [
    {
      ref: `${ELVISH_LYRIST.oracleId}#a0`,
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
