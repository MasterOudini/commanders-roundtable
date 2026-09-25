// `Gluttonous Cyclops` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLUTTONOUS_CYCLOPS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLUTTONOUS_CYCLOPS, "{5}{R}{R}: Monstrosity 3. (If this creature isn't monstrous, put three +1/+1 counters on it and it becomes monstrous.)");

const VOCAB_A0 = vocabularyEffects("Monstrosity 3.", GLUTTONOUS_CYCLOPS.name);
const VOCAB_T_A0 = vocabularyTargets("Monstrosity 3.");

export const GLUTTONOUS_CYCLOPS_SCRIPT: CardScript = {
  oracleId: GLUTTONOUS_CYCLOPS.oracleId,
  name: GLUTTONOUS_CYCLOPS.name,
  activated: [
    {
      ref: `${GLUTTONOUS_CYCLOPS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
