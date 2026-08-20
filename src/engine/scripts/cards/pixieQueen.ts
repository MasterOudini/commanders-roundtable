// `Pixie Queen` — "{G}{G}{G}, {T}: Target creature gains flying until
// end of turn." Akki Drillmaster's grant, greener and airborne. D233.

import { PIXIE_QUEEN } from '../../../data/fixtures/engineCards';
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
  PIXIE_QUEEN,
  'Flying\n{G}{G}{G}, {T}: Target creature gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const PIXIE_QUEEN_SCRIPT: CardScript = {
  oracleId: PIXIE_QUEEN.oracleId,
  name: PIXIE_QUEEN.name,
  activated: [
    {
      ref: `${PIXIE_QUEEN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['flying'] },
        ];
      },
    },
  ],
};
