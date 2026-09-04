// `Tireless Tribe` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TIRELESS_TRIBE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TIRELESS_TRIBE, "Discard a card: This creature gets +0/+4 until end of turn.");

export const TIRELESS_TRIBE_SCRIPT: CardScript = {
  oracleId: TIRELESS_TRIBE.oracleId,
  name: TIRELESS_TRIBE.name,
  activated: [
    {
      ref: `${TIRELESS_TRIBE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 4 }];
      },
    },
  ],
};
