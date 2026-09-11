// `Jamuraan Lion` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JAMURAAN_LION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JAMURAAN_LION, "{W}, {T}: Target creature can't block this turn.");

const VOCAB_A0 = vocabularyEffects("Target creature can't block this turn.", JAMURAAN_LION.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this turn.");

export const JAMURAAN_LION_SCRIPT: CardScript = {
  oracleId: JAMURAAN_LION.oracleId,
  name: JAMURAAN_LION.name,
  activated: [
    {
      ref: `${JAMURAAN_LION.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
