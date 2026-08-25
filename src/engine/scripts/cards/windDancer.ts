// `Wind Dancer` — flying plus a {T} flying grant. The keyword line never
// counts, so the ability is `#a0` and its text is `split[1]`. D269.

import { WIND_DANCER } from '../../../data/fixtures/engineCards';
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
  WIND_DANCER,
  'Flying\n{T}: Target creature gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const WIND_DANCER_SCRIPT: CardScript = {
  oracleId: WIND_DANCER.oracleId,
  name: WIND_DANCER.name,
  activated: [
    {
      ref: `${WIND_DANCER.oracleId}#a0`,
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
