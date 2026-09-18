// `Cogwork Assembler` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COGWORK_ASSEMBLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COGWORK_ASSEMBLER, "{7}: Create a token that's a copy of target artifact. That token gains haste. Exile it at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("Create a token that's a copy of target artifact. That token gains haste. Exile it at the beginning of the next end step.", COGWORK_ASSEMBLER.name);
const VOCAB_T_A0 = vocabularyTargets("Create a token that's a copy of target artifact. That token gains haste. Exile it at the beginning of the next end step.");

export const COGWORK_ASSEMBLER_SCRIPT: CardScript = {
  oracleId: COGWORK_ASSEMBLER.oracleId,
  name: COGWORK_ASSEMBLER.name,
  activated: [
    {
      ref: `${COGWORK_ASSEMBLER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
