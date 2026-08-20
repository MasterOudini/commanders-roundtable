// `Bloodlust Inciter` — "{T}: Target creature gains haste until end of
// turn." The Axgard Cavalry text's THIRD oracle id. D200.

import { BLOODLUST_INCITER } from '../../../data/fixtures/engineCards';
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
  BLOODLUST_INCITER,
  '{T}: Target creature gains haste until end of turn. (It can attack and {T} this turn.)',
);

export const BLOODLUST_INCITER_SCRIPT: CardScript = {
  oracleId: BLOODLUST_INCITER.oracleId,
  name: BLOODLUST_INCITER.name,
  activated: [
    {
      ref: `${BLOODLUST_INCITER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['haste'] },
        ];
      },
    },
  ],
};
