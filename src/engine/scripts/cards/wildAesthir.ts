// `Wild Aesthir` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WILD_AESTHIR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WILD_AESTHIR, "Flying, first strike\n{W}{W}: This creature gets +2/+0 until end of turn. Activate only once each turn.");
const LINES = PRINTED.split('\n');

export const WILD_AESTHIR_SCRIPT: CardScript = {
  oracleId: WILD_AESTHIR.oracleId,
  name: WILD_AESTHIR.name,
  activated: [
    {
      ref: `${WILD_AESTHIR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
