// `Spikeshot Elder` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIKESHOT_ELDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIKESHOT_ELDER, "{1}{R}{R}: This creature deals damage equal to its power to any target.");

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to its power to any target.", SPIKESHOT_ELDER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to its power to any target.");

export const SPIKESHOT_ELDER_SCRIPT: CardScript = {
  oracleId: SPIKESHOT_ELDER.oracleId,
  name: SPIKESHOT_ELDER.name,
  activated: [
    {
      ref: `${SPIKESHOT_ELDER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
