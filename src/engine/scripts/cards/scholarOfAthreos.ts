// `Scholar of Athreos` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCHOLAR_OF_ATHREOS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCHOLAR_OF_ATHREOS, "{2}{B}: Each opponent loses 1 life. You gain life equal to the life lost this way.");

const VOCAB_A0 = vocabularyEffects("Each opponent loses 1 life. You gain life equal to the life lost this way.", SCHOLAR_OF_ATHREOS.name);
const VOCAB_T_A0 = vocabularyTargets("Each opponent loses 1 life. You gain life equal to the life lost this way.");

export const SCHOLAR_OF_ATHREOS_SCRIPT: CardScript = {
  oracleId: SCHOLAR_OF_ATHREOS.oracleId,
  name: SCHOLAR_OF_ATHREOS.name,
  activated: [
    {
      ref: `${SCHOLAR_OF_ATHREOS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
