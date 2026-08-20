// `Goblin Motivator` — "{T}: Target creature gains haste until end of
// turn." Akki Drillmaster's shape, with this printing's reminder text
// carried verbatim. D216.

import { GOBLIN_MOTIVATOR } from '../../../data/fixtures/engineCards';
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
  GOBLIN_MOTIVATOR,
  '{T}: Target creature gains haste until end of turn. (It can attack and {T} this turn.)',
);

export const GOBLIN_MOTIVATOR_SCRIPT: CardScript = {
  oracleId: GOBLIN_MOTIVATOR.oracleId,
  name: GOBLIN_MOTIVATOR.name,
  activated: [
    {
      ref: `${GOBLIN_MOTIVATOR.oracleId}#a0`,
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
            keywords: ['haste'],
          },
        ];
      },
    },
  ],
};
