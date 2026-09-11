// `Sif's Spearmaster` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIF_S_SPEARMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIF_S_SPEARMASTER, "{T}: This creature deals damage equal to its power to target opponent.");

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to its power to target opponent.", SIF_S_SPEARMASTER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to its power to target opponent.");

export const SIFS_SPEARMASTER_SCRIPT: CardScript = {
  oracleId: SIF_S_SPEARMASTER.oracleId,
  name: SIF_S_SPEARMASTER.name,
  activated: [
    {
      ref: `${SIF_S_SPEARMASTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
