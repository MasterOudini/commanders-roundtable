// `Phoenix of Ash` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHOENIX_OF_ASH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHOENIX_OF_ASH, "Flying, haste\n{2}{R}: This creature gets +2/+0 until end of turn.\nEscape—{2}{R}{R}, Exile three other cards from your graveyard. (You may cast this card from your graveyard for its escape cost.)\nThis creature escapes with a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

export const PHOENIX_OF_ASH_SCRIPT: CardScript = {
  oracleId: PHOENIX_OF_ASH.oracleId,
  name: PHOENIX_OF_ASH.name,
  activated: [
    {
      ref: `${PHOENIX_OF_ASH.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
