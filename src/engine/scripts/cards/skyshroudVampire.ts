// `Skyshroud Vampire` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYSHROUD_VAMPIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYSHROUD_VAMPIRE, "Flying\nDiscard a creature card: This creature gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const SKYSHROUD_VAMPIRE_SCRIPT: CardScript = {
  oracleId: SKYSHROUD_VAMPIRE.oracleId,
  name: SKYSHROUD_VAMPIRE.name,
  activated: [
    {
      ref: `${SKYSHROUD_VAMPIRE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
};
