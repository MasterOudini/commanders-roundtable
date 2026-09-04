// `Tattered Apparition` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { TATTERED_APPARITION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TATTERED_APPARITION, "Flying\n{1}{B}: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const TATTERED_APPARITION_SCRIPT: CardScript = {
  oracleId: TATTERED_APPARITION.oracleId,
  name: TATTERED_APPARITION.name,
  activated: [
    {
      ref: `${TATTERED_APPARITION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
