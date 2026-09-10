// `Split-Tail Miko` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPLIT_TAIL_MIKO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPLIT_TAIL_MIKO, "{W}, {T}: Prevent the next 2 damage that would be dealt to any target this turn.");

const VOCAB_A0 = vocabularyEffects("Prevent the next 2 damage that would be dealt to any target this turn.", SPLIT_TAIL_MIKO.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 2 damage that would be dealt to any target this turn.");

export const SPLIT_TAIL_MIKO_SCRIPT: CardScript = {
  oracleId: SPLIT_TAIL_MIKO.oracleId,
  name: SPLIT_TAIL_MIKO.name,
  activated: [
    {
      ref: `${SPLIT_TAIL_MIKO.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
