// `Welding Jar` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WELDING_JAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WELDING_JAR, "Sacrifice this artifact: Regenerate target artifact.");

const VOCAB_A0 = vocabularyEffects("Regenerate target artifact.", WELDING_JAR.name);
const VOCAB_T_A0 = vocabularyTargets("Regenerate target artifact.");

export const WELDING_JAR_SCRIPT: CardScript = {
  oracleId: WELDING_JAR.oracleId,
  name: WELDING_JAR.name,
  activated: [
    {
      ref: `${WELDING_JAR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
