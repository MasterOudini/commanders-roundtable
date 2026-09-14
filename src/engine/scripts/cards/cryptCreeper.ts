// `Crypt Creeper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRYPT_CREEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRYPT_CREEPER, "Sacrifice this creature: Exile target card from a graveyard.");

const VOCAB_A0 = vocabularyEffects("Exile target card from a graveyard.", CRYPT_CREEPER.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target card from a graveyard.");

export const CRYPT_CREEPER_SCRIPT: CardScript = {
  oracleId: CRYPT_CREEPER.oracleId,
  name: CRYPT_CREEPER.name,
  activated: [
    {
      ref: `${CRYPT_CREEPER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
