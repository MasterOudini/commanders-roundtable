// `White Shield Crusader` - a one-shot pump on itself / itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { WHITE_SHIELD_CRUSADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHITE_SHIELD_CRUSADER, "Protection from black\n{W}: This creature gains flying until end of turn.\n{W}{W}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const WHITE_SHIELD_CRUSADER_SCRIPT: CardScript = {
  oracleId: WHITE_SHIELD_CRUSADER.oracleId,
  name: WHITE_SHIELD_CRUSADER.name,
  activated: [
    {
      ref: `${WHITE_SHIELD_CRUSADER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
    {
      ref: `${WHITE_SHIELD_CRUSADER.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
