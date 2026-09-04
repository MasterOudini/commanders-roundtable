// `Olivia's Dragoon` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OLIVIA_S_DRAGOON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OLIVIA_S_DRAGOON, "Discard a card: This creature gains flying until end of turn.");

export const OLIVIAS_DRAGOON_SCRIPT: CardScript = {
  oracleId: OLIVIA_S_DRAGOON.oracleId,
  name: OLIVIA_S_DRAGOON.name,
  activated: [
    {
      ref: `${OLIVIA_S_DRAGOON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
};
