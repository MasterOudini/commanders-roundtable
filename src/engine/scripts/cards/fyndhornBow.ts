// `Fyndhorn Bow` — "{3}, {T}: Target creature gains first strike until end
// of turn." Flying Carpet's shape with the first-strike rider. D215.

import { FYNDHORN_BOW } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FYNDHORN_BOW, '{3}, {T}: Target creature gains first strike until end of turn.');

export const FYNDHORN_BOW_SCRIPT: CardScript = {
  oracleId: FYNDHORN_BOW.oracleId,
  name: FYNDHORN_BOW.name,
  activated: [
    {
      ref: `${FYNDHORN_BOW.oracleId}#a0`,
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
            keywords: ['firstStrike'],
          },
        ];
      },
    },
  ],
};
