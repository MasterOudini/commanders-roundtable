// `Blood Host` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOOD_HOST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOOD_HOST, "{1}{B}, Sacrifice another creature: Put a +1/+1 counter on this creature and you gain 2 life.");

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature and you gain 2 life.", BLOOD_HOST.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature and you gain 2 life.");

export const BLOOD_HOST_SCRIPT: CardScript = {
  oracleId: BLOOD_HOST.oracleId,
  name: BLOOD_HOST.name,
  activated: [
    {
      ref: `${BLOOD_HOST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
