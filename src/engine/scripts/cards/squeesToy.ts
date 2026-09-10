// `Squee's Toy` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SQUEE_S_TOY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SQUEE_S_TOY, "{T}: Prevent the next 1 damage that would be dealt to target creature this turn.");

const VOCAB_A0 = vocabularyEffects("Prevent the next 1 damage that would be dealt to target creature this turn.", SQUEE_S_TOY.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 1 damage that would be dealt to target creature this turn.");

export const SQUEES_TOY_SCRIPT: CardScript = {
  oracleId: SQUEE_S_TOY.oracleId,
  name: SQUEE_S_TOY.name,
  activated: [
    {
      ref: `${SQUEE_S_TOY.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
