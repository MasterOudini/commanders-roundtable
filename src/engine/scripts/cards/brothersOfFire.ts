// `Brothers of Fire` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BROTHERS_OF_FIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BROTHERS_OF_FIRE, "{1}{R}{R}: This creature deals 1 damage to any target and 1 damage to you.");

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to any target and 1 damage to you.", BROTHERS_OF_FIRE.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to any target and 1 damage to you.");

export const BROTHERS_OF_FIRE_SCRIPT: CardScript = {
  oracleId: BROTHERS_OF_FIRE.oracleId,
  name: BROTHERS_OF_FIRE.name,
  activated: [
    {
      ref: `${BROTHERS_OF_FIRE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
