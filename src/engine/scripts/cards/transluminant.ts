// `Transluminant` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRANSLUMINANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRANSLUMINANT, "{W}, Sacrifice this creature: Create a 1/1 white Spirit creature token with flying at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("Create a 1/1 white Spirit creature token with flying at the beginning of the next end step.", TRANSLUMINANT.name);
const VOCAB_T_A0 = vocabularyTargets("Create a 1/1 white Spirit creature token with flying at the beginning of the next end step.");

export const TRANSLUMINANT_SCRIPT: CardScript = {
  oracleId: TRANSLUMINANT.oracleId,
  name: TRANSLUMINANT.name,
  activated: [
    {
      ref: `${TRANSLUMINANT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
