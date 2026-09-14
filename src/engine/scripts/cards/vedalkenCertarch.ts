// `Vedalken Certarch` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VEDALKEN_CERTARCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VEDALKEN_CERTARCH, "Metalcraft — {T}: Tap target artifact, creature, or land. Activate only if you control three or more artifacts.");

const VOCAB_A0 = vocabularyEffects("Tap target artifact, creature, or land.", VEDALKEN_CERTARCH.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target artifact, creature, or land.");

export const VEDALKEN_CERTARCH_SCRIPT: CardScript = {
  oracleId: VEDALKEN_CERTARCH.oracleId,
  name: VEDALKEN_CERTARCH.name,
  activated: [
    {
      ref: `${VEDALKEN_CERTARCH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
