// `Zhuge Jin, Wu Strategist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZHUGE_JIN_WU_STRATEGIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZHUGE_JIN_WU_STRATEGIST, "{T}: Target creature can't be blocked this turn. Activate only during your turn, before attackers are declared.");

const VOCAB_A0 = vocabularyEffects("Target creature can't be blocked this turn.", ZHUGE_JIN_WU_STRATEGIST.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't be blocked this turn.");

export const ZHUGE_JIN_WU_STRATEGIST_SCRIPT: CardScript = {
  oracleId: ZHUGE_JIN_WU_STRATEGIST.oracleId,
  name: ZHUGE_JIN_WU_STRATEGIST.name,
  activated: [
    {
      ref: `${ZHUGE_JIN_WU_STRATEGIST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
