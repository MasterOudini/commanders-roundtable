// `Viridian Zealot` — Undergrowth Leopard's self-sacrifice compound destroy
// (D263), one cost over. Both kinds of the noun list PROBED enforced. D266.

import { VIRIDIAN_ZEALOT } from '../../../data/fixtures/engineCards';
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
  VIRIDIAN_ZEALOT,
  '{1}{G}, Sacrifice this creature: Destroy target artifact or enchantment.',
);

export const VIRIDIAN_ZEALOT_SCRIPT: CardScript = {
  oracleId: VIRIDIAN_ZEALOT.oracleId,
  name: VIRIDIAN_ZEALOT.name,
  activated: [
    {
      ref: `${VIRIDIAN_ZEALOT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
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
