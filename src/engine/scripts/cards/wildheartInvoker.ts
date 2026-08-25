// `Wildheart Invoker` — "{8}: Target creature gets +5/+5 and gains trample
// until end of turn." Pump AND keyword in ONE modification (Welkin Guide's
// shape, D268). No {T} in the cost, so with enough mana it goes twice. D269.

import { WILDHEART_INVOKER } from '../../../data/fixtures/engineCards';
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
  WILDHEART_INVOKER,
  "{8}: Target creature gets +5/+5 and gains trample until end of turn. (It can deal excess combat damage to the player or planeswalker it's attacking.)",
);

export const WILDHEART_INVOKER_SCRIPT: CardScript = {
  oracleId: WILDHEART_INVOKER.oracleId,
  name: WILDHEART_INVOKER.name,
  activated: [
    {
      ref: `${WILDHEART_INVOKER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 5,
            toughness: 5,
            keywords: ['trample'],
          },
        ];
      },
    },
  ],
};
