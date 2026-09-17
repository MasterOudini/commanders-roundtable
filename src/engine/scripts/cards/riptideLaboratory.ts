// `Riptide Laboratory` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIPTIDE_LABORATORY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIPTIDE_LABORATORY, "{T}: Add {C}.\n{1}{U}, {T}: Return target Wizard you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Return target Wizard you control to its owner's hand.", RIPTIDE_LABORATORY.name);
const VOCAB_T_A1 = vocabularyTargets("Return target Wizard you control to its owner's hand.");

export const RIPTIDE_LABORATORY_SCRIPT: CardScript = {
  oracleId: RIPTIDE_LABORATORY.oracleId,
  name: RIPTIDE_LABORATORY.name,
  activated: [
    {
      ref: `${RIPTIDE_LABORATORY.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
