// `Haystack` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAYSTACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAYSTACK, "{2}, {T}: Target creature you control phases out. (Treat it and anything attached to it as though they don't exist until your next turn.)");

const VOCAB_A0 = vocabularyEffects("Target creature you control phases out.", HAYSTACK.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control phases out.");

export const HAYSTACK_SCRIPT: CardScript = {
  oracleId: HAYSTACK.oracleId,
  name: HAYSTACK.name,
  activated: [
    {
      ref: `${HAYSTACK.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
