// `Snake Basket` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SNAKE_BASKET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SNAKE_BASKET, "{X}, Sacrifice this artifact: Create X 1/1 green Snake creature tokens. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Create X 1/1 green Snake creature tokens.", SNAKE_BASKET.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("Create X 1/1 green Snake creature tokens.");

export const SNAKE_BASKET_SCRIPT: CardScript = {
  oracleId: SNAKE_BASKET.oracleId,
  name: SNAKE_BASKET.name,
  activated: [
    {
      ref: `${SNAKE_BASKET.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
