// `Pain Kami` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PAIN_KAMI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PAIN_KAMI, "{X}{R}, Sacrifice this creature: It deals X damage to target creature.");

const VOCAB_A0 = vocabularyEffects("~ deals X damage to target creature.", PAIN_KAMI.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("~ deals X damage to target creature.");

export const PAIN_KAMI_SCRIPT: CardScript = {
  oracleId: PAIN_KAMI.oracleId,
  name: PAIN_KAMI.name,
  activated: [
    {
      ref: `${PAIN_KAMI.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
