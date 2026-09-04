// `Trenching Steed` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRENCHING_STEED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRENCHING_STEED, "Sacrifice a land: This creature gets +0/+3 until end of turn.");

export const TRENCHING_STEED_SCRIPT: CardScript = {
  oracleId: TRENCHING_STEED.oracleId,
  name: TRENCHING_STEED.name,
  activated: [
    {
      ref: `${TRENCHING_STEED.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 3 }];
      },
    },
  ],
};
