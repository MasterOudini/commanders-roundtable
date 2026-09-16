// `Stampeding Scurryfoot` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STAMPEDING_SCURRYFOOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STAMPEDING_SCURRYFOOT, "Exhaust — {3}{G}: Put a +1/+1 counter on this creature. Create a 3/3 green Elephant creature token. (Activate each exhaust ability only once.)");

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature. Create a 3/3 green Elephant creature token.", STAMPEDING_SCURRYFOOT.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature. Create a 3/3 green Elephant creature token.");

export const STAMPEDING_SCURRYFOOT_SCRIPT: CardScript = {
  oracleId: STAMPEDING_SCURRYFOOT.oracleId,
  name: STAMPEDING_SCURRYFOOT.name,
  activated: [
    {
      ref: `${STAMPEDING_SCURRYFOOT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
