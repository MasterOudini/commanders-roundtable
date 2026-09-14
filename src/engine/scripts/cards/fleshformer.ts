// `Fleshformer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLESHFORMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLESHFORMER, "{W}{U}{B}{R}{G}: This creature gets +2/+2 and gains fear until end of turn. Target creature gets -2/-2 until end of turn. Activate only during your turn. (A creature with fear can't be blocked except by artifact creatures and/or black creatures.)");

const VOCAB_A0 = vocabularyEffects("~ gets +2/+2 and gains fear until end of turn. Target creature gets -2/-2 until end of turn.", FLESHFORMER.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +2/+2 and gains fear until end of turn. Target creature gets -2/-2 until end of turn.");

export const FLESHFORMER_SCRIPT: CardScript = {
  oracleId: FLESHFORMER.oracleId,
  name: FLESHFORMER.name,
  activated: [
    {
      ref: `${FLESHFORMER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
