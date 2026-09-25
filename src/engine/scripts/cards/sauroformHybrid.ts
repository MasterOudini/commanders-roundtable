// `Sauroform Hybrid` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAUROFORM_HYBRID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAUROFORM_HYBRID, "{4}{G}{G}: Adapt 4. (If this creature has no +1/+1 counters on it, put four +1/+1 counters on it.)");

const VOCAB_A0 = vocabularyEffects("Adapt 4.", SAUROFORM_HYBRID.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 4.");

export const SAUROFORM_HYBRID_SCRIPT: CardScript = {
  oracleId: SAUROFORM_HYBRID.oracleId,
  name: SAUROFORM_HYBRID.name,
  activated: [
    {
      ref: `${SAUROFORM_HYBRID.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
