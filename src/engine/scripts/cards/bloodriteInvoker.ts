// `Bloodrite Invoker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODRITE_INVOKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODRITE_INVOKER, "{8}: Target player loses 3 life and you gain 3 life.");

const VOCAB_A0 = vocabularyEffects("Target player loses 3 life and you gain 3 life.", BLOODRITE_INVOKER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player loses 3 life and you gain 3 life.");

export const BLOODRITE_INVOKER_SCRIPT: CardScript = {
  oracleId: BLOODRITE_INVOKER.oracleId,
  name: BLOODRITE_INVOKER.name,
  activated: [
    {
      ref: `${BLOODRITE_INVOKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
