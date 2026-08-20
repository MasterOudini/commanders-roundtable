// `Flying Carpet` — "{2}, {T}: Target creature gains flying until end of
// turn." Advance Scout's grant on an artifact. D214.

import { FLYING_CARPET } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FLYING_CARPET, '{2}, {T}: Target creature gains flying until end of turn.');

export const FLYING_CARPET_SCRIPT: CardScript = {
  oracleId: FLYING_CARPET.oracleId,
  name: FLYING_CARPET.name,
  activated: [
    {
      ref: `${FLYING_CARPET.oracleId}#a0`,
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
            keywords: ['flying'],
          },
        ];
      },
    },
  ],
};
