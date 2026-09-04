// `Order of the Ebon Hand` - a one-shot pump on itself / itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { ORDER_OF_THE_EBON_HAND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORDER_OF_THE_EBON_HAND, "Protection from white\n{B}: This creature gains first strike until end of turn.\n{B}{B}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const ORDER_OF_THE_EBON_HAND_SCRIPT: CardScript = {
  oracleId: ORDER_OF_THE_EBON_HAND.oracleId,
  name: ORDER_OF_THE_EBON_HAND.name,
  activated: [
    {
      ref: `${ORDER_OF_THE_EBON_HAND.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
    {
      ref: `${ORDER_OF_THE_EBON_HAND.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
