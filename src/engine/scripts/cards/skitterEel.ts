// `Skitter Eel` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKITTER_EEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKITTER_EEL, "{2}{U}: Adapt 2. (If this creature has no +1/+1 counters on it, put two +1/+1 counters on it.)");

const VOCAB_A0 = vocabularyEffects("Adapt 2.", SKITTER_EEL.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 2.");

export const SKITTER_EEL_SCRIPT: CardScript = {
  oracleId: SKITTER_EEL.oracleId,
  name: SKITTER_EEL.name,
  activated: [
    {
      ref: `${SKITTER_EEL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
