// `Tradewind Rider` — Flying is the engine's; its own tap and two untapped
// creatures I control tapped (the D286 tap chooser) return a target
// permanent to its owner's hand.

import { TRADEWIND_RIDER } from '../../../data/fixtures/engineCards';
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
  TRADEWIND_RIDER,
  "Flying\n{T}, Tap two untapped creatures you control: Return target permanent to its owner's hand.",
);
const BOUNCE = PRINTED.split('\n')[1] as string;

export const TRADEWIND_RIDER_SCRIPT: CardScript = {
  oracleId: TRADEWIND_RIDER.oracleId,
  name: TRADEWIND_RIDER.name,
  activated: [
    {
      ref: `${TRADEWIND_RIDER.oracleId}#a0`,
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
