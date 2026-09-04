// `Gruul Nodorog` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { GRUUL_NODOROG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRUUL_NODOROG, "{R}: This creature gains menace until end of turn. (It can't be blocked except by two or more creatures.)");

export const GRUUL_NODOROG_SCRIPT: CardScript = {
  oracleId: GRUUL_NODOROG.oracleId,
  name: GRUUL_NODOROG.name,
  activated: [
    {
      ref: `${GRUUL_NODOROG.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
};
