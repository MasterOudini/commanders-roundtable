// `Vedalken Mastermind` — the {U}, {T} own-permanent bounce. The "you
// control" restriction PROBED as enforced, so the aim refuses an opponent's
// permanent and this def only says what the ability does. D265.

import { VEDALKEN_MASTERMIND } from '../../../data/fixtures/engineCards';
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
  VEDALKEN_MASTERMIND,
  "{U}, {T}: Return target permanent you control to its owner's hand.",
);

export const VEDALKEN_MASTERMIND_SCRIPT: CardScript = {
  oracleId: VEDALKEN_MASTERMIND.oracleId,
  name: VEDALKEN_MASTERMIND.name,
  activated: [
    {
      ref: `${VEDALKEN_MASTERMIND.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
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
