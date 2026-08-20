// `Harmattan Efreet` — Flying (Tier 2) plus "{1}{U}{U}: Target creature
// gains flying until end of turn." The keyword line never counts, so the
// grant is #a0. D216.

import { HARMATTAN_EFREET } from '../../../data/fixtures/engineCards';
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
  HARMATTAN_EFREET,
  'Flying\n{1}{U}{U}: Target creature gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const HARMATTAN_EFREET_SCRIPT: CardScript = {
  oracleId: HARMATTAN_EFREET.oracleId,
  name: HARMATTAN_EFREET.name,
  activated: [
    {
      ref: `${HARMATTAN_EFREET.oracleId}#a0`,
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
