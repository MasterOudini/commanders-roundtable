// `Phyrexian Reclamation` — "{1}{B}, Pay 2 life: Return target creature
// card from your graveyard to your hand." The life-priced graveyard
// return on an enchantment. D233.

import { PHYREXIAN_RECLAMATION } from '../../../data/fixtures/engineCards';
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
  PHYREXIAN_RECLAMATION,
  '{1}{B}, Pay 2 life: Return target creature card from your graveyard to your hand.',
);

export const PHYREXIAN_RECLAMATION_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_RECLAMATION.oracleId,
  name: PHYREXIAN_RECLAMATION.name,
  activated: [
    {
      ref: `${PHYREXIAN_RECLAMATION.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        const graveOwner = card.zone.player;
        if (!graveOwner) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'graveyard', player: graveOwner },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
