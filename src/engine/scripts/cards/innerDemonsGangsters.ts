// `Inner Demons Gangsters` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INNER_DEMONS_GANGSTERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INNER_DEMONS_GANGSTERS, "Discard a card: This creature gets +1/+0 and gains menace until end of turn. Activate only as a sorcery. (It can't be blocked except by two or more creatures.)");

export const INNER_DEMONS_GANGSTERS_SCRIPT: CardScript = {
  oracleId: INNER_DEMONS_GANGSTERS.oracleId,
  name: INNER_DEMONS_GANGSTERS.name,
  activated: [
    {
      ref: `${INNER_DEMONS_GANGSTERS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
};
