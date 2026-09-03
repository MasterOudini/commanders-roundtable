// `Keeper of the Nine Gales` — Flying is the engine's; its own tap and two
// untapped Birds I control tapped (the D286 tap chooser; the Keeper is a
// Bird) return a target permanent to its owner's hand.

import { KEEPER_OF_THE_NINE_GALES } from '../../../data/fixtures/engineCards';
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
  KEEPER_OF_THE_NINE_GALES,
  "Flying\n{T}, Tap two untapped Birds you control: Return target permanent to its owner's hand.",
);
const BOUNCE = PRINTED.split('\n')[1] as string;

export const KEEPER_OF_THE_NINE_GALES_SCRIPT: CardScript = {
  oracleId: KEEPER_OF_THE_NINE_GALES.oracleId,
  name: KEEPER_OF_THE_NINE_GALES.name,
  activated: [
    {
      ref: `${KEEPER_OF_THE_NINE_GALES.oracleId}#a0`,
      text: BOUNCE,
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
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
