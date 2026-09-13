// `River Hoopoe` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIVER_HOOPOE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIVER_HOOPOE, "Flying\n{3}{G}{U}: You gain 2 life and draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("You gain 2 life and draw a card.", RIVER_HOOPOE.name);
const VOCAB_T_A0 = vocabularyTargets("You gain 2 life and draw a card.");

export const RIVER_HOOPOE_SCRIPT: CardScript = {
  oracleId: RIVER_HOOPOE.oracleId,
  name: RIVER_HOOPOE.name,
  activated: [
    {
      ref: `${RIVER_HOOPOE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
