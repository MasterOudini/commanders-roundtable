// `Xun Yu, Wei Advisor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { XUN_YU_WEI_ADVISOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(XUN_YU_WEI_ADVISOR, "{T}: Target creature you control gets +2/+0 until end of turn. Activate only during your turn, before attackers are declared.");

const VOCAB_A0 = vocabularyEffects("Target creature you control gets +2/+0 until end of turn.", XUN_YU_WEI_ADVISOR.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gets +2/+0 until end of turn.");

export const XUN_YU_WEI_ADVISOR_SCRIPT: CardScript = {
  oracleId: XUN_YU_WEI_ADVISOR.oracleId,
  name: XUN_YU_WEI_ADVISOR.name,
  activated: [
    {
      ref: `${XUN_YU_WEI_ADVISOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
