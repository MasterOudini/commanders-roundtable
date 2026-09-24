// `Aladdin` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALADDIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALADDIN, "{1}{R}{R}, {T}: Gain control of target artifact for as long as you control this creature.");

const VOCAB_A0 = vocabularyEffects("Gain control of target artifact for as long as you control this creature.", ALADDIN.name);
const VOCAB_T_A0 = vocabularyTargets("Gain control of target artifact for as long as you control this creature.");

export const ALADDIN_SCRIPT: CardScript = {
  oracleId: ALADDIN.oracleId,
  name: ALADDIN.name,
  activated: [
    {
      ref: `${ALADDIN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
