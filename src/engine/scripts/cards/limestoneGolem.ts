// `Limestone Golem` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIMESTONE_GOLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIMESTONE_GOLEM, "{2}, Sacrifice this creature: Target player draws a card.");

const VOCAB_A0 = vocabularyEffects("Target player draws a card.", LIMESTONE_GOLEM.name);
const VOCAB_T_A0 = vocabularyTargets("Target player draws a card.");

export const LIMESTONE_GOLEM_SCRIPT: CardScript = {
  oracleId: LIMESTONE_GOLEM.oracleId,
  name: LIMESTONE_GOLEM.name,
  activated: [
    {
      ref: `${LIMESTONE_GOLEM.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
