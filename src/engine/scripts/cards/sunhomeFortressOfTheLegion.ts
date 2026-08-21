// `Sunhome, Fortress of the Legion` — the DOUBLE-STRIKE grant land at #a1
// behind the mana line; the keyword rides D194's carrier and ends at
// cleanup. D255.

import { SUNHOME_FORTRESS_OF_THE_LEGION } from '../../../data/fixtures/engineCards';
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
  SUNHOME_FORTRESS_OF_THE_LEGION,
  '{T}: Add {C}.\n{2}{R}{W}, {T}: Target creature gains double strike until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SUNHOME_FORTRESS_OF_THE_LEGION_SCRIPT: CardScript = {
  oracleId: SUNHOME_FORTRESS_OF_THE_LEGION.oracleId,
  name: SUNHOME_FORTRESS_OF_THE_LEGION.name,
  activated: [
    {
      ref: `${SUNHOME_FORTRESS_OF_THE_LEGION.oracleId}#a1`,
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
            keywords: ['doubleStrike'],
          },
        ];
      },
    },
  ],
};
