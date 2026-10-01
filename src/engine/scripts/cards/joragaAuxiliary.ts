// `Joraga Auxiliary` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JORAGA_AUXILIARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JORAGA_AUXILIARY, "{4}{G}{W}: Support 2. (Put a +1/+1 counter on each of up to two other target creatures.)");

const VOCAB_A0 = vocabularyEffects("Support 2.", JORAGA_AUXILIARY.name);
const VOCAB_T_A0 = vocabularyTargets("Support 2.");

export const JORAGA_AUXILIARY_SCRIPT: CardScript = {
  oracleId: JORAGA_AUXILIARY.oracleId,
  name: JORAGA_AUXILIARY.name,
  activated: [
    {
      ref: `${JORAGA_AUXILIARY.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
