// `Seeker of Sunlight` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEEKER_OF_SUNLIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEEKER_OF_SUNLIGHT, "{2}{G}: This creature explores. Activate only as a sorcery. (Reveal the top card of your library. Put that card into your hand if it's a land. Otherwise, put a +1/+1 counter on this creature, then put the card back or put it into your graveyard.)");

const VOCAB_A0 = vocabularyEffects("~ explores.", SEEKER_OF_SUNLIGHT.name);
const VOCAB_T_A0 = vocabularyTargets("~ explores.");

export const SEEKER_OF_SUNLIGHT_SCRIPT: CardScript = {
  oracleId: SEEKER_OF_SUNLIGHT.oracleId,
  name: SEEKER_OF_SUNLIGHT.name,
  activated: [
    {
      ref: `${SEEKER_OF_SUNLIGHT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
