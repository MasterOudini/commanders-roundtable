// `Dauthi Trapper` — "{T}: Target creature gains shadow until end of turn."
// Dauthi Embrace's grant behind a tap instead of mana. D206.

import { DAUTHI_TRAPPER } from '../../../data/fixtures/engineCards';
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
  DAUTHI_TRAPPER,
  '{T}: Target creature gains shadow until end of turn. (It can block or be blocked by only creatures with shadow.)',
);

export const DAUTHI_TRAPPER_SCRIPT: CardScript = {
  oracleId: DAUTHI_TRAPPER.oracleId,
  name: DAUTHI_TRAPPER.name,
  activated: [
    {
      ref: `${DAUTHI_TRAPPER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['shadow'],
          },
        ];
      },
    },
  ],
};
