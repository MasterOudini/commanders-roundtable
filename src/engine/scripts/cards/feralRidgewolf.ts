// `Feral Ridgewolf` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { FERAL_RIDGEWOLF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FERAL_RIDGEWOLF, "Trample\n{1}{R}: This creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const FERAL_RIDGEWOLF_SCRIPT: CardScript = {
  oracleId: FERAL_RIDGEWOLF.oracleId,
  name: FERAL_RIDGEWOLF.name,
  activated: [
    {
      ref: `${FERAL_RIDGEWOLF.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
