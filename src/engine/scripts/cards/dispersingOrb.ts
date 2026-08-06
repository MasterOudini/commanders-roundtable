// `Dispersing Orb` — "{3}{U}, Sacrifice a permanent: Return target permanent
// to its owner's hand." Barrin's empty-predicate chooser on an ENCHANTMENT,
// bouncing any permanent — the card goes to its OWNER's hand (CR 108.4),
// whoever controls it now. M6.4o, D171.

import { DISPERSING_ORB } from '../../../data/fixtures/engineCards';
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
  DISPERSING_ORB,
  "{3}{U}, Sacrifice a permanent: Return target permanent to its owner's hand.",
);

export const DISPERSING_ORB_SCRIPT: CardScript = {
  oracleId: DISPERSING_ORB.oracleId,
  name: DISPERSING_ORB.name,
  activated: [
    {
      ref: `${DISPERSING_ORB.oracleId}#a0`,
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
