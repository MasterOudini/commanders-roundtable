// `Tavern Swindler` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TAVERN_SWINDLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TAVERN_SWINDLER, "{T}, Pay 3 life: Flip a coin. If you win the flip, you gain 6 life.");

const VOCAB_A0 = vocabularyEffects("Flip a coin. If you win the flip, you gain 6 life.", TAVERN_SWINDLER.name);
const VOCAB_T_A0 = vocabularyTargets("Flip a coin. If you win the flip, you gain 6 life.");

export const TAVERN_SWINDLER_SCRIPT: CardScript = {
  oracleId: TAVERN_SWINDLER.oracleId,
  name: TAVERN_SWINDLER.name,
  activated: [
    {
      ref: `${TAVERN_SWINDLER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
