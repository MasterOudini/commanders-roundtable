// `Crazed Armodon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRAZED_ARMODON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRAZED_ARMODON, "{G}: This creature gets +3/+0 and gains trample until end of turn. Destroy this creature at the beginning of the next end step. Activate only once each turn.");

const VOCAB_A0 = vocabularyEffects("~ gets +3/+0 and gains trample until end of turn. Destroy this creature at the beginning of the next end step.", CRAZED_ARMODON.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +3/+0 and gains trample until end of turn. Destroy this creature at the beginning of the next end step.");

export const CRAZED_ARMODON_SCRIPT: CardScript = {
  oracleId: CRAZED_ARMODON.oracleId,
  name: CRAZED_ARMODON.name,
  activated: [
    {
      ref: `${CRAZED_ARMODON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
