// `Scorchwalker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCORCHWALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCORCHWALKER, "Bloodrush — {1}{R}{R}, Discard this card: Target attacking creature gets +5/+1 until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target attacking creature gets +5/+1 until end of turn.", SCORCHWALKER.name);
const VOCAB_T_A0 = vocabularyTargets("Target attacking creature gets +5/+1 until end of turn.");

export const SCORCHWALKER_SCRIPT: CardScript = {
  oracleId: SCORCHWALKER.oracleId,
  name: SCORCHWALKER.name,
  activated: [
    {
      ref: `${SCORCHWALKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
