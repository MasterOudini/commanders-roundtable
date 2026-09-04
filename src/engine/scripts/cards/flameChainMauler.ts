// `Flame-Chain Mauler` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { FLAME_CHAIN_MAULER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLAME_CHAIN_MAULER, "{1}{R}: This creature gets +1/+0 and gains menace until end of turn. (It can't be blocked except by two or more creatures.)");

export const FLAME_CHAIN_MAULER_SCRIPT: CardScript = {
  oracleId: FLAME_CHAIN_MAULER.oracleId,
  name: FLAME_CHAIN_MAULER.name,
  activated: [
    {
      ref: `${FLAME_CHAIN_MAULER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
};
