// `Rockcaster Platoon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROCKCASTER_PLATOON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROCKCASTER_PLATOON, "{4}{G}: This creature deals 2 damage to each creature with flying and each player.");

const VOCAB_A0 = vocabularyEffects("~ deals 2 damage to each creature with flying and each player.", ROCKCASTER_PLATOON.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 2 damage to each creature with flying and each player.");

export const ROCKCASTER_PLATOON_SCRIPT: CardScript = {
  oracleId: ROCKCASTER_PLATOON.oracleId,
  name: ROCKCASTER_PLATOON.name,
  activated: [
    {
      ref: `${ROCKCASTER_PLATOON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
