// `Kami of Twisted Reflection` — "Sacrifice this creature: Return target
// creature you control to its owner's hand." The no-mana self-sacrifice
// paying for Iceridge Serpent's bounce, restricted to MY side. M6.4aa,
// D183.

import { KAMI_OF_TWISTED_REFLECTION } from '../../../data/fixtures/engineCards';
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
  KAMI_OF_TWISTED_REFLECTION,
  "Sacrifice this creature: Return target creature you control to its owner's hand.",
);

export const KAMI_OF_TWISTED_REFLECTION_SCRIPT: CardScript = {
  oracleId: KAMI_OF_TWISTED_REFLECTION.oracleId,
  name: KAMI_OF_TWISTED_REFLECTION.name,
  activated: [
    {
      ref: `${KAMI_OF_TWISTED_REFLECTION.oracleId}#a0`,
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
