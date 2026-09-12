// `Hypnotic Grifter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HYPNOTIC_GRIFTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HYPNOTIC_GRIFTER, "{3}: This creature connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.)");

const VOCAB_A0 = vocabularyEffects("~ connives.", HYPNOTIC_GRIFTER.name);
const VOCAB_T_A0 = vocabularyTargets("~ connives.");

export const HYPNOTIC_GRIFTER_SCRIPT: CardScript = {
  oracleId: HYPNOTIC_GRIFTER.oracleId,
  name: HYPNOTIC_GRIFTER.name,
  activated: [
    {
      ref: `${HYPNOTIC_GRIFTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
