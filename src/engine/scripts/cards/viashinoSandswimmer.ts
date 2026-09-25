// `Viashino Sandswimmer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIASHINO_SANDSWIMMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIASHINO_SANDSWIMMER, "{R}: Flip a coin. If you win the flip, return this creature to its owner's hand. If you lose the flip, sacrifice this creature.");

const VOCAB_A0 = vocabularyEffects("Flip a coin. If you win the flip, return this creature to its owner's hand. If you lose the flip, sacrifice this creature.", VIASHINO_SANDSWIMMER.name);
const VOCAB_T_A0 = vocabularyTargets("Flip a coin. If you win the flip, return this creature to its owner's hand. If you lose the flip, sacrifice this creature.");

export const VIASHINO_SANDSWIMMER_SCRIPT: CardScript = {
  oracleId: VIASHINO_SANDSWIMMER.oracleId,
  name: VIASHINO_SANDSWIMMER.name,
  activated: [
    {
      ref: `${VIASHINO_SANDSWIMMER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
