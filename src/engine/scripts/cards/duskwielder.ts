// `Duskwielder` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUSKWIELDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUSKWIELDER, "Boast — {1}: Target opponent loses 1 life and you gain 1 life. (Activate only if this creature attacked this turn and only once each turn.)");

const VOCAB_A0 = vocabularyEffects("Target opponent loses 1 life and you gain 1 life.", DUSKWIELDER.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent loses 1 life and you gain 1 life.");

export const DUSKWIELDER_SCRIPT: CardScript = {
  oracleId: DUSKWIELDER.oracleId,
  name: DUSKWIELDER.name,
  activated: [
    {
      ref: `${DUSKWIELDER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
