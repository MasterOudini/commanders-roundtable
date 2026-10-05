// `Resilient Wanderer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RESILIENT_WANDERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RESILIENT_WANDERER, "First strike\nDiscard a card: This creature gains protection from the color of your choice until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gains protection from the color of your choice until end of turn.", RESILIENT_WANDERER.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains protection from the color of your choice until end of turn.");

export const RESILIENT_WANDERER_SCRIPT: CardScript = {
  oracleId: RESILIENT_WANDERER.oracleId,
  name: RESILIENT_WANDERER.name,
  activated: [
    {
      ref: `${RESILIENT_WANDERER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
