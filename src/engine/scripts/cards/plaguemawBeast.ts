// `Plaguemaw Beast` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PLAGUEMAW_BEAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PLAGUEMAW_BEAST, "{T}, Sacrifice a creature: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");

const VOCAB_A0 = vocabularyEffects("Proliferate.", PLAGUEMAW_BEAST.name);
const VOCAB_T_A0 = vocabularyTargets("Proliferate.");

export const PLAGUEMAW_BEAST_SCRIPT: CardScript = {
  oracleId: PLAGUEMAW_BEAST.oracleId,
  name: PLAGUEMAW_BEAST.name,
  activated: [
    {
      ref: `${PLAGUEMAW_BEAST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
