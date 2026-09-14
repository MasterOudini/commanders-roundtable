// `Cathartic Adept` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CATHARTIC_ADEPT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CATHARTIC_ADEPT, "{T}: Target player mills a card.");

const VOCAB_A0 = vocabularyEffects("Target player mills a card.", CATHARTIC_ADEPT.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills a card.");

export const CATHARTIC_ADEPT_SCRIPT: CardScript = {
  oracleId: CATHARTIC_ADEPT.oracleId,
  name: CATHARTIC_ADEPT.name,
  activated: [
    {
      ref: `${CATHARTIC_ADEPT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
