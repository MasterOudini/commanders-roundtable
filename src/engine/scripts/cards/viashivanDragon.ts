// `Viashivan Dragon` - a one-shot pump on itself / itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { VIASHIVAN_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIASHIVAN_DRAGON, "Flying\n{R}: This creature gets +1/+0 until end of turn.\n{G}: This creature gets +0/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const VIASHIVAN_DRAGON_SCRIPT: CardScript = {
  oracleId: VIASHIVAN_DRAGON.oracleId,
  name: VIASHIVAN_DRAGON.name,
  activated: [
    {
      ref: `${VIASHIVAN_DRAGON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
    {
      ref: `${VIASHIVAN_DRAGON.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 1 }];
      },
    },
  ],
};
