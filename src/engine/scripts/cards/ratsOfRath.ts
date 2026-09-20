// `Rats of Rath` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RATS_OF_RATH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RATS_OF_RATH, "{B}: Destroy target artifact, creature, or land you control.");

const VOCAB_A0 = vocabularyEffects("Destroy target artifact, creature, or land you control.", RATS_OF_RATH.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact, creature, or land you control.");

export const RATS_OF_RATH_SCRIPT: CardScript = {
  oracleId: RATS_OF_RATH.oracleId,
  name: RATS_OF_RATH.name,
  activated: [
    {
      ref: `${RATS_OF_RATH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
