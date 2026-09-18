// `Syndicate Trafficker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SYNDICATE_TRAFFICKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SYNDICATE_TRAFFICKER, "{1}, Sacrifice an artifact: Put a +1/+1 counter on this creature. It gains indestructible until end of turn.");

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature. It gains indestructible until end of turn.", SYNDICATE_TRAFFICKER.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature. It gains indestructible until end of turn.");

export const SYNDICATE_TRAFFICKER_SCRIPT: CardScript = {
  oracleId: SYNDICATE_TRAFFICKER.oracleId,
  name: SYNDICATE_TRAFFICKER.name,
  activated: [
    {
      ref: `${SYNDICATE_TRAFFICKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
