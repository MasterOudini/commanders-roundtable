// `Argivian Blacksmith` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARGIVIAN_BLACKSMITH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARGIVIAN_BLACKSMITH, "{T}: Prevent the next 2 damage that would be dealt to target artifact creature this turn.");

const VOCAB_A0 = vocabularyEffects("Prevent the next 2 damage that would be dealt to target artifact creature this turn.", ARGIVIAN_BLACKSMITH.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 2 damage that would be dealt to target artifact creature this turn.");

export const ARGIVIAN_BLACKSMITH_SCRIPT: CardScript = {
  oracleId: ARGIVIAN_BLACKSMITH.oracleId,
  name: ARGIVIAN_BLACKSMITH.name,
  activated: [
    {
      ref: `${ARGIVIAN_BLACKSMITH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
