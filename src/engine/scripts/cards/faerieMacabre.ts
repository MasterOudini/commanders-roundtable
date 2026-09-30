// `Faerie Macabre` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAERIE_MACABRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAERIE_MACABRE, "Flying\nDiscard this card: Exile up to two target cards from graveyards.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile up to two target cards from graveyards.", FAERIE_MACABRE.name);
const VOCAB_T_A0 = vocabularyTargets("Exile up to two target cards from graveyards.");

export const FAERIE_MACABRE_SCRIPT: CardScript = {
  oracleId: FAERIE_MACABRE.oracleId,
  name: FAERIE_MACABRE.name,
  activated: [
    {
      ref: `${FAERIE_MACABRE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
