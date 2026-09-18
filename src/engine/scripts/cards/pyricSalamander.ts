// `Pyric Salamander` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PYRIC_SALAMANDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PYRIC_SALAMANDER, "{R}: This creature gets +1/+0 until end of turn. Sacrifice this creature at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("~ gets +1/+0 until end of turn. Sacrifice this creature at the beginning of the next end step.", PYRIC_SALAMANDER.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +1/+0 until end of turn. Sacrifice this creature at the beginning of the next end step.");

export const PYRIC_SALAMANDER_SCRIPT: CardScript = {
  oracleId: PYRIC_SALAMANDER.oracleId,
  name: PYRIC_SALAMANDER.name,
  activated: [
    {
      ref: `${PYRIC_SALAMANDER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
