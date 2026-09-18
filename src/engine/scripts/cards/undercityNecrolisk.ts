// `Undercity Necrolisk` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNDERCITY_NECROLISK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNDERCITY_NECROLISK, "{1}, Sacrifice another creature: Put a +1/+1 counter on this creature. It gains menace until end of turn. Activate only as a sorcery. (It can't be blocked except by two or more creatures.)");

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature. It gains menace until end of turn.", UNDERCITY_NECROLISK.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature. It gains menace until end of turn.");

export const UNDERCITY_NECROLISK_SCRIPT: CardScript = {
  oracleId: UNDERCITY_NECROLISK.oracleId,
  name: UNDERCITY_NECROLISK.name,
  activated: [
    {
      ref: `${UNDERCITY_NECROLISK.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
