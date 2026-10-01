// `Screeching Griffin` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCREECHING_GRIFFIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCREECHING_GRIFFIN, "Flying\n{R}: Target creature can't block this creature this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't block this creature this turn.", SCREECHING_GRIFFIN.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this creature this turn.");

export const SCREECHING_GRIFFIN_SCRIPT: CardScript = {
  oracleId: SCREECHING_GRIFFIN.oracleId,
  name: SCREECHING_GRIFFIN.name,
  activated: [
    {
      ref: `${SCREECHING_GRIFFIN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
