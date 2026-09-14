// `Withered Wretch` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WITHERED_WRETCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WITHERED_WRETCH, "{1}: Exile target card from a graveyard.");

const VOCAB_A0 = vocabularyEffects("Exile target card from a graveyard.", WITHERED_WRETCH.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target card from a graveyard.");

export const WITHERED_WRETCH_SCRIPT: CardScript = {
  oracleId: WITHERED_WRETCH.oracleId,
  name: WITHERED_WRETCH.name,
  activated: [
    {
      ref: `${WITHERED_WRETCH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
