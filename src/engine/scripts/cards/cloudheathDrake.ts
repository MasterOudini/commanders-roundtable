// `Cloudheath Drake` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { CLOUDHEATH_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLOUDHEATH_DRAKE, "Flying\n{1}{W}: This creature gains vigilance until end of turn.");
const LINES = PRINTED.split('\n');

export const CLOUDHEATH_DRAKE_SCRIPT: CardScript = {
  oracleId: CLOUDHEATH_DRAKE.oracleId,
  name: CLOUDHEATH_DRAKE.name,
  activated: [
    {
      ref: `${CLOUDHEATH_DRAKE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["vigilance"] }];
      },
    },
  ],
};
