// `Merciless Javelineer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MERCILESS_JAVELINEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MERCILESS_JAVELINEER, "{2}, Discard a card: Put a -1/-1 counter on target creature. That creature can't block this turn.");

const VOCAB_A0 = vocabularyEffects("Put a -1/-1 counter on target creature. That creature can't block this turn.", MERCILESS_JAVELINEER.name);
const VOCAB_T_A0 = vocabularyTargets("Put a -1/-1 counter on target creature. That creature can't block this turn.");

export const MERCILESS_JAVELINEER_SCRIPT: CardScript = {
  oracleId: MERCILESS_JAVELINEER.oracleId,
  name: MERCILESS_JAVELINEER.name,
  activated: [
    {
      ref: `${MERCILESS_JAVELINEER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
