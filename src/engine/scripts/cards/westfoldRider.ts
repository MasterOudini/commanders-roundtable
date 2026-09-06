// `Westfold Rider` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WESTFOLD_RIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WESTFOLD_RIDER, "Sacrifice this creature: Destroy target artifact or enchantment. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Destroy target artifact or enchantment.", WESTFOLD_RIDER.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact or enchantment.");

export const WESTFOLD_RIDER_SCRIPT: CardScript = {
  oracleId: WESTFOLD_RIDER.oracleId,
  name: WESTFOLD_RIDER.name,
  activated: [
    {
      ref: `${WESTFOLD_RIDER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
