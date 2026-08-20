// `Noble Steeds` — "{1}{W}: Target creature gains first strike until end
// of turn." The activated D194 grant on an enchantment. D229.

import { NOBLE_STEEDS } from '../../../data/fixtures/engineCards';
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
  NOBLE_STEEDS,
  '{1}{W}: Target creature gains first strike until end of turn.',
);

export const NOBLE_STEEDS_SCRIPT: CardScript = {
  oracleId: NOBLE_STEEDS.oracleId,
  name: NOBLE_STEEDS.name,
  activated: [
    {
      ref: `${NOBLE_STEEDS.oracleId}#a0`,
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
