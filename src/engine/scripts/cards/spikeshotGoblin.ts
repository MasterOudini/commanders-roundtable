// `Spikeshot Goblin` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIKESHOT_GOBLIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIKESHOT_GOBLIN, "{R}, {T}: This creature deals damage equal to its power to any target.");

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to its power to any target.", SPIKESHOT_GOBLIN.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to its power to any target.");

export const SPIKESHOT_GOBLIN_SCRIPT: CardScript = {
  oracleId: SPIKESHOT_GOBLIN.oracleId,
  name: SPIKESHOT_GOBLIN.name,
  activated: [
    {
      ref: `${SPIKESHOT_GOBLIN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
