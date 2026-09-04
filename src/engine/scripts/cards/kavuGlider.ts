// `Kavu Glider` - a one-shot pump on itself / itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { KAVU_GLIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAVU_GLIDER, "{W}: This creature gets +0/+1 until end of turn.\n{U}: This creature gains flying until end of turn.");
const LINES = PRINTED.split('\n');

export const KAVU_GLIDER_SCRIPT: CardScript = {
  oracleId: KAVU_GLIDER.oracleId,
  name: KAVU_GLIDER.name,
  activated: [
    {
      ref: `${KAVU_GLIDER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 1 }];
      },
    },
    {
      ref: `${KAVU_GLIDER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
};
