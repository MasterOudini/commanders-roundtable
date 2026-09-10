// `Magma Vein` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAGMA_VEIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAGMA_VEIN, "{R}, Sacrifice a land: This enchantment deals 1 damage to each creature without flying.");

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature without flying.", MAGMA_VEIN.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature without flying.");

export const MAGMA_VEIN_SCRIPT: CardScript = {
  oracleId: MAGMA_VEIN.oracleId,
  name: MAGMA_VEIN.name,
  activated: [
    {
      ref: `${MAGMA_VEIN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
