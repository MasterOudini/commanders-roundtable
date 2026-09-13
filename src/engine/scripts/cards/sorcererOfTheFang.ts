// `Sorcerer of the Fang` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SORCERER_OF_THE_FANG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SORCERER_OF_THE_FANG, "{5}{B}, {T}: This creature deals 2 damage to target opponent or planeswalker.");

const VOCAB_A0 = vocabularyEffects("~ deals 2 damage to target opponent or planeswalker.", SORCERER_OF_THE_FANG.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 2 damage to target opponent or planeswalker.");

export const SORCERER_OF_THE_FANG_SCRIPT: CardScript = {
  oracleId: SORCERER_OF_THE_FANG.oracleId,
  name: SORCERER_OF_THE_FANG.name,
  activated: [
    {
      ref: `${SORCERER_OF_THE_FANG.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
