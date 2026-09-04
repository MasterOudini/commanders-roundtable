// `Aven Trooper` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { AVEN_TROOPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVEN_TROOPER, "Flying\n{2}{W}, Discard a card: This creature gets +1/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const AVEN_TROOPER_SCRIPT: CardScript = {
  oracleId: AVEN_TROOPER.oracleId,
  name: AVEN_TROOPER.name,
  activated: [
    {
      ref: `${AVEN_TROOPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 2 }];
      },
    },
  ],
};
