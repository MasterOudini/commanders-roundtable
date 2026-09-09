// `Vector Asp` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VECTOR_ASP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VECTOR_ASP, "{B}: This creature gains infect until end of turn. (It deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)");

export const VECTOR_ASP_SCRIPT: CardScript = {
  oracleId: VECTOR_ASP.oracleId,
  name: VECTOR_ASP.name,
  activated: [
    {
      ref: `${VECTOR_ASP.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["infect"] }];
      },
    },
  ],
};
