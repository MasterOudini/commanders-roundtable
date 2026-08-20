// `Ixalli's Keeper` — "{7}{G}, {T}, Sacrifice this creature: Target
// creature gets +5/+5 and gains trample until end of turn." The
// sacrifice-self cost feeding a pump-and-grant. D220.

import { IXALLI_S_KEEPER } from '../../../data/fixtures/engineCards';
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
  IXALLI_S_KEEPER,
  '{7}{G}, {T}, Sacrifice this creature: Target creature gets +5/+5 and gains trample until end of turn.',
);

export const IXALLIS_KEEPER_SCRIPT: CardScript = {
  oracleId: IXALLI_S_KEEPER.oracleId,
  name: IXALLI_S_KEEPER.name,
  activated: [
    {
      ref: `${IXALLI_S_KEEPER.oracleId}#a0`,
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
