// `Expendable Troops` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXPENDABLE_TROOPS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXPENDABLE_TROOPS, "{T}, Sacrifice this creature: It deals 2 damage to target attacking or blocking creature.");

const VOCAB_A0 = vocabularyEffects("~ deals 2 damage to target attacking or blocking creature.", EXPENDABLE_TROOPS.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 2 damage to target attacking or blocking creature.");

export const EXPENDABLE_TROOPS_SCRIPT: CardScript = {
  oracleId: EXPENDABLE_TROOPS.oracleId,
  name: EXPENDABLE_TROOPS.name,
  activated: [
    {
      ref: `${EXPENDABLE_TROOPS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
