// `Miren, the Moaning Well` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIREN_THE_MOANING_WELL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIREN_THE_MOANING_WELL, "{T}: Add {C}.\n{3}, {T}, Sacrifice a creature: You gain life equal to the sacrificed creature's toughness.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("You gain life equal to the sacrificed creature's toughness.", MIREN_THE_MOANING_WELL.name);
const VOCAB_T_A1 = vocabularyTargets("You gain life equal to the sacrificed creature's toughness.");

export const MIREN_THE_MOANING_WELL_SCRIPT: CardScript = {
  oracleId: MIREN_THE_MOANING_WELL.oracleId,
  name: MIREN_THE_MOANING_WELL.name,
  activated: [
    {
      ref: `${MIREN_THE_MOANING_WELL.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
