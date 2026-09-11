// `Alloy Animist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALLOY_ANIMIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALLOY_ANIMIST, "{2}{G}: Until end of turn, target noncreature artifact you control becomes a 4/4 artifact creature.");

const VOCAB_A0 = vocabularyEffects("Until end of turn, target noncreature artifact you control becomes a 4/4 artifact creature.", ALLOY_ANIMIST.name);
const VOCAB_T_A0 = vocabularyTargets("Until end of turn, target noncreature artifact you control becomes a 4/4 artifact creature.");

export const ALLOY_ANIMIST_SCRIPT: CardScript = {
  oracleId: ALLOY_ANIMIST.oracleId,
  name: ALLOY_ANIMIST.name,
  activated: [
    {
      ref: `${ALLOY_ANIMIST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
