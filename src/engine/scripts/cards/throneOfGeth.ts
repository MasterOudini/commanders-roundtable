// `Throne of Geth` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THRONE_OF_GETH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(THRONE_OF_GETH, "{T}, Sacrifice an artifact: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");

const VOCAB_A0 = vocabularyEffects("Proliferate.", THRONE_OF_GETH.name);
const VOCAB_T_A0 = vocabularyTargets("Proliferate.");

export const THRONE_OF_GETH_SCRIPT: CardScript = {
  oracleId: THRONE_OF_GETH.oracleId,
  name: THRONE_OF_GETH.name,
  activated: [
    {
      ref: `${THRONE_OF_GETH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
