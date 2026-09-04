// `Black Oak of Odunos` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { BLACK_OAK_OF_ODUNOS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLACK_OAK_OF_ODUNOS, "Defender\n{B}, Tap another untapped creature you control: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const BLACK_OAK_OF_ODUNOS_SCRIPT: CardScript = {
  oracleId: BLACK_OAK_OF_ODUNOS.oracleId,
  name: BLACK_OAK_OF_ODUNOS.name,
  activated: [
    {
      ref: `${BLACK_OAK_OF_ODUNOS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
