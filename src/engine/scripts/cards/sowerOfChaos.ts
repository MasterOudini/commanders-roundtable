// `Sower of Chaos` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOWER_OF_CHAOS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOWER_OF_CHAOS, "{2}{R}: Target creature can't block this turn.");

const VOCAB_A0 = vocabularyEffects("Target creature can't block this turn.", SOWER_OF_CHAOS.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this turn.");

export const SOWER_OF_CHAOS_SCRIPT: CardScript = {
  oracleId: SOWER_OF_CHAOS.oracleId,
  name: SOWER_OF_CHAOS.name,
  activated: [
    {
      ref: `${SOWER_OF_CHAOS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
