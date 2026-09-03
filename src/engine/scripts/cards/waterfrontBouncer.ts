// `Waterfront Bouncer` — blue mana, the tap and a discarded card of my
// choice (D286) return a creature to its owner's hand.

import { WATERFRONT_BOUNCER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WATERFRONT_BOUNCER, "{U}, {T}, Discard a card: Return target creature to its owner's hand.");

export const WATERFRONT_BOUNCER_SCRIPT: CardScript = {
  oracleId: WATERFRONT_BOUNCER.oracleId,
  name: WATERFRONT_BOUNCER.name,
  activated: [
    {
      ref: `${WATERFRONT_BOUNCER.oracleId}#a0`,
      text: TEXT,
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
