// `Judge's Familiar` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JUDGE_S_FAMILIAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JUDGE_S_FAMILIAR, "Flying\nSacrifice this creature: Counter target instant or sorcery spell unless its controller pays {1}.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Counter target instant or sorcery spell unless its controller pays {1}.", JUDGE_S_FAMILIAR.name);
const VOCAB_T_A0 = vocabularyTargets("Counter target instant or sorcery spell unless its controller pays {1}.");

export const JUDGES_FAMILIAR_SCRIPT: CardScript = {
  oracleId: JUDGE_S_FAMILIAR.oracleId,
  name: JUDGE_S_FAMILIAR.name,
  activated: [
    {
      ref: `${JUDGE_S_FAMILIAR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
