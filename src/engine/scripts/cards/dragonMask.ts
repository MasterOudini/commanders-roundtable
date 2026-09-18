// `Dragon Mask` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAGON_MASK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRAGON_MASK, "{3}, {T}: Target creature you control gets +2/+2 until end of turn. Return it to its owner's hand at the beginning of the next end step. (Return it only if it's on the battlefield.)");

const VOCAB_A0 = vocabularyEffects("Target creature you control gets +2/+2 until end of turn. Return it to its owner's hand at the beginning of the next end step.", DRAGON_MASK.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gets +2/+2 until end of turn. Return it to its owner's hand at the beginning of the next end step.");

export const DRAGON_MASK_SCRIPT: CardScript = {
  oracleId: DRAGON_MASK.oracleId,
  name: DRAGON_MASK.name,
  activated: [
    {
      ref: `${DRAGON_MASK.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
