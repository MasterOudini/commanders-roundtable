// `Carrion Howler` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CARRION_HOWLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CARRION_HOWLER, "Pay 1 life: This creature gets +2/-1 until end of turn.");

export const CARRION_HOWLER_SCRIPT: CardScript = {
  oracleId: CARRION_HOWLER.oracleId,
  name: CARRION_HOWLER.name,
  activated: [
    {
      ref: `${CARRION_HOWLER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: -1 }];
      },
    },
  ],
};
