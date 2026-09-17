// `Daru Encampment` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARU_ENCAMPMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARU_ENCAMPMENT, "{T}: Add {C}.\n{W}, {T}: Target Soldier creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target Soldier creature gets +1/+1 until end of turn.", DARU_ENCAMPMENT.name);
const VOCAB_T_A1 = vocabularyTargets("Target Soldier creature gets +1/+1 until end of turn.");

export const DARU_ENCAMPMENT_SCRIPT: CardScript = {
  oracleId: DARU_ENCAMPMENT.oracleId,
  name: DARU_ENCAMPMENT.name,
  activated: [
    {
      ref: `${DARU_ENCAMPMENT.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
