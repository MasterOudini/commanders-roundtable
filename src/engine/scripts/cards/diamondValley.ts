// `Diamond Valley` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIAMOND_VALLEY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIAMOND_VALLEY, "{T}, Sacrifice a creature: You gain life equal to the sacrificed creature's toughness.");

const VOCAB_A0 = vocabularyEffects("You gain life equal to the sacrificed creature's toughness.", DIAMOND_VALLEY.name);
const VOCAB_T_A0 = vocabularyTargets("You gain life equal to the sacrificed creature's toughness.");

export const DIAMOND_VALLEY_SCRIPT: CardScript = {
  oracleId: DIAMOND_VALLEY.oracleId,
  name: DIAMOND_VALLEY.name,
  activated: [
    {
      ref: `${DIAMOND_VALLEY.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
