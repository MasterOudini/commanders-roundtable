// `Anaba Ancestor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANABA_ANCESTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANABA_ANCESTOR, "{T}: Another target Minotaur creature gets +1/+1 until end of turn.");

const VOCAB_A0 = vocabularyEffects("Another target Minotaur creature gets +1/+1 until end of turn.", ANABA_ANCESTOR.name);
const VOCAB_T_A0 = vocabularyTargets("Another target Minotaur creature gets +1/+1 until end of turn.");

export const ANABA_ANCESTOR_SCRIPT: CardScript = {
  oracleId: ANABA_ANCESTOR.oracleId,
  name: ANABA_ANCESTOR.name,
  activated: [
    {
      ref: `${ANABA_ANCESTOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
