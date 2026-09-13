// `Specter of the Fens` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPECTER_OF_THE_FENS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPECTER_OF_THE_FENS, "Flying\n{5}{B}: Target opponent loses 2 life and you gain 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target opponent loses 2 life and you gain 2 life.", SPECTER_OF_THE_FENS.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent loses 2 life and you gain 2 life.");

export const SPECTER_OF_THE_FENS_SCRIPT: CardScript = {
  oracleId: SPECTER_OF_THE_FENS.oracleId,
  name: SPECTER_OF_THE_FENS.name,
  activated: [
    {
      ref: `${SPECTER_OF_THE_FENS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
