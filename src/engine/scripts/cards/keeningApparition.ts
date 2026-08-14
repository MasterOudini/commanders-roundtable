// `Keening Apparition` — "Sacrifice this creature: Destroy target
// enchantment." Kami of Ancient Law's EXACT text on its own oracle id, in
// the same batch. M6.4aa, D183.

import { KEENING_APPARITION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(KEENING_APPARITION, 'Sacrifice this creature: Destroy target enchantment.');

export const KEENING_APPARITION_SCRIPT: CardScript = {
  oracleId: KEENING_APPARITION.oracleId,
  name: KEENING_APPARITION.name,
  activated: [
    {
      ref: `${KEENING_APPARITION.oracleId}#a0`,
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
