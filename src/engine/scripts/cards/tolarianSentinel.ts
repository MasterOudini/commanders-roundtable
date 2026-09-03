// `Tolarian Sentinel` — Flying is the engine's; blue mana, the tap and a
// discarded card of my choice (D286) return a permanent I control to its
// owner's hand.

import { TOLARIAN_SENTINEL } from '../../../data/fixtures/engineCards';
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
  TOLARIAN_SENTINEL,
  "Flying\n{U}, {T}, Discard a card: Return target permanent you control to its owner's hand.",
);
const BOUNCE = PRINTED.split('\n')[1] as string;

export const TOLARIAN_SENTINEL_SCRIPT: CardScript = {
  oracleId: TOLARIAN_SENTINEL.oracleId,
  name: TOLARIAN_SENTINEL.name,
  activated: [
    {
      ref: `${TOLARIAN_SENTINEL.oracleId}#a0`,
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
