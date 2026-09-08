// `Seraph of the Scales` - an activation pumping itself, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERAPH_OF_THE_SCALES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERAPH_OF_THE_SCALES, "Flying\n{W}: This creature gains vigilance until end of turn.\n{B}: This creature gains deathtouch until end of turn.\nAfterlife 2 (When this creature dies, create two 1/1 white and black Spirit creature tokens with flying.)");
const LINES = PRINTED.split('\n');

export const SERAPH_OF_THE_SCALES_SCRIPT: CardScript = {
  oracleId: SERAPH_OF_THE_SCALES.oracleId,
  name: SERAPH_OF_THE_SCALES.name,
  activated: [
    {
      ref: `${SERAPH_OF_THE_SCALES.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["vigilance"] }];
      },
    },
    {
      ref: `${SERAPH_OF_THE_SCALES.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
};
