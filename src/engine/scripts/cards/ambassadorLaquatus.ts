// `Ambassador Laquatus` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AMBASSADOR_LAQUATUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AMBASSADOR_LAQUATUS, "{3}: Target player mills three cards.");

const VOCAB_A0 = vocabularyEffects("Target player mills three cards.", AMBASSADOR_LAQUATUS.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills three cards.");

export const AMBASSADOR_LAQUATUS_SCRIPT: CardScript = {
  oracleId: AMBASSADOR_LAQUATUS.oracleId,
  name: AMBASSADOR_LAQUATUS.name,
  activated: [
    {
      ref: `${AMBASSADOR_LAQUATUS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
