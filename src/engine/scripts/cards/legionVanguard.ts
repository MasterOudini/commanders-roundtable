// `Legion Vanguard` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEGION_VANGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LEGION_VANGUARD, "{1}, Sacrifice another creature: This creature explores. (Reveal the top card of your library. Put that card into your hand if it's a land. Otherwise, put a +1/+1 counter on this creature, then put the card back or put it into your graveyard.)");

const VOCAB_A0 = vocabularyEffects("~ explores.", LEGION_VANGUARD.name);
const VOCAB_T_A0 = vocabularyTargets("~ explores.");

export const LEGION_VANGUARD_SCRIPT: CardScript = {
  oracleId: LEGION_VANGUARD.oracleId,
  name: LEGION_VANGUARD.name,
  activated: [
    {
      ref: `${LEGION_VANGUARD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
