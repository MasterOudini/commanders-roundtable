// `Trolls of Tel-Jilad` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TROLLS_OF_TEL_JILAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TROLLS_OF_TEL_JILAD, "{1}{G}: Regenerate target green creature.");

const VOCAB_A0 = vocabularyEffects("Regenerate target green creature.", TROLLS_OF_TEL_JILAD.name);
const VOCAB_T_A0 = vocabularyTargets("Regenerate target green creature.");

export const TROLLS_OF_TEL_JILAD_SCRIPT: CardScript = {
  oracleId: TROLLS_OF_TEL_JILAD.oracleId,
  name: TROLLS_OF_TEL_JILAD.name,
  activated: [
    {
      ref: `${TROLLS_OF_TEL_JILAD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
