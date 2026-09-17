// `Krosan Groundshaker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KROSAN_GROUNDSHAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROSAN_GROUNDSHAKER, "{G}: Target Beast creature gains trample until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target Beast creature gains trample until end of turn.", KROSAN_GROUNDSHAKER.name);
const VOCAB_T_A0 = vocabularyTargets("Target Beast creature gains trample until end of turn.");

export const KROSAN_GROUNDSHAKER_SCRIPT: CardScript = {
  oracleId: KROSAN_GROUNDSHAKER.oracleId,
  name: KROSAN_GROUNDSHAKER.name,
  activated: [
    {
      ref: `${KROSAN_GROUNDSHAKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
