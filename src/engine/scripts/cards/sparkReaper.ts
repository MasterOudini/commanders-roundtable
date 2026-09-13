// `Spark Reaper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPARK_REAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPARK_REAPER, "{3}, Sacrifice a creature or planeswalker: You gain 1 life and draw a card.");

const VOCAB_A0 = vocabularyEffects("You gain 1 life and draw a card.", SPARK_REAPER.name);
const VOCAB_T_A0 = vocabularyTargets("You gain 1 life and draw a card.");

export const SPARK_REAPER_SCRIPT: CardScript = {
  oracleId: SPARK_REAPER.oracleId,
  name: SPARK_REAPER.name,
  activated: [
    {
      ref: `${SPARK_REAPER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
