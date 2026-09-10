// `King Crab` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KING_CRAB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KING_CRAB, "{1}{U}, {T}: Put target green creature on top of its owner's library.");

const VOCAB_A0 = vocabularyEffects("Put target green creature on top of its owner's library.", KING_CRAB.name);
const VOCAB_T_A0 = vocabularyTargets("Put target green creature on top of its owner's library.");

export const KING_CRAB_SCRIPT: CardScript = {
  oracleId: KING_CRAB.oracleId,
  name: KING_CRAB.name,
  activated: [
    {
      ref: `${KING_CRAB.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
