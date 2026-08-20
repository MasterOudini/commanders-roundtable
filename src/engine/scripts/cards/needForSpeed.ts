// `Need for Speed` — "Sacrifice a land: Target creature gains haste until
// end of turn." Aura Fracture's no-mana land chooser paying for the D194
// rider. D228.

import { NEED_FOR_SPEED } from '../../../data/fixtures/engineCards';
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
  NEED_FOR_SPEED,
  'Sacrifice a land: Target creature gains haste until end of turn.',
);

export const NEED_FOR_SPEED_SCRIPT: CardScript = {
  oracleId: NEED_FOR_SPEED.oracleId,
  name: NEED_FOR_SPEED.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${NEED_FOR_SPEED.oracleId}#a0`,
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
