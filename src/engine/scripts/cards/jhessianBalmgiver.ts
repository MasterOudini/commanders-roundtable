// `Jhessian Balmgiver` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JHESSIAN_BALMGIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JHESSIAN_BALMGIVER, "{T}: Prevent the next 1 damage that would be dealt to any target this turn.\n{T}: Target creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Prevent the next 1 damage that would be dealt to any target this turn.", JHESSIAN_BALMGIVER.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 1 damage that would be dealt to any target this turn.");
const VOCAB_A1 = vocabularyEffects("Target creature can't be blocked this turn.", JHESSIAN_BALMGIVER.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature can't be blocked this turn.");

export const JHESSIAN_BALMGIVER_SCRIPT: CardScript = {
  oracleId: JHESSIAN_BALMGIVER.oracleId,
  name: JHESSIAN_BALMGIVER.name,
  activated: [
    {
      ref: `${JHESSIAN_BALMGIVER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${JHESSIAN_BALMGIVER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
