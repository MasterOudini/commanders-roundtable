// `Caller of Gales` — "{1}{U}, {T}: Target creature gains flying until end
// of turn." The mana-plus-tap activated grant. D202.

import { CALLER_OF_GALES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CALLER_OF_GALES, '{1}{U}, {T}: Target creature gains flying until end of turn.');

export const CALLER_OF_GALES_SCRIPT: CardScript = {
  oracleId: CALLER_OF_GALES.oracleId,
  name: CALLER_OF_GALES.name,
  activated: [
    {
      ref: `${CALLER_OF_GALES.oracleId}#a0`,
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
