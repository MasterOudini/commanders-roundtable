// `Folk of the Pines` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { FOLK_OF_THE_PINES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FOLK_OF_THE_PINES, "{1}{G}: This creature gets +1/+0 until end of turn.");

export const FOLK_OF_THE_PINES_SCRIPT: CardScript = {
  oracleId: FOLK_OF_THE_PINES.oracleId,
  name: FOLK_OF_THE_PINES.name,
  activated: [
    {
      ref: `${FOLK_OF_THE_PINES.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
