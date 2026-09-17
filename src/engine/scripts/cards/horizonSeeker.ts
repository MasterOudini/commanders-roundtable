// `Horizon Seeker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HORIZON_SEEKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HORIZON_SEEKER, "Boast — {1}{G}: Search your library for a basic land card, reveal it, put it into your hand, then shuffle. (Activate only if this creature attacked this turn and only once each turn.)");

const VOCAB_A0 = vocabularyEffects("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.", HORIZON_SEEKER.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.");

export const HORIZON_SEEKER_SCRIPT: CardScript = {
  oracleId: HORIZON_SEEKER.oracleId,
  name: HORIZON_SEEKER.name,
  activated: [
    {
      ref: `${HORIZON_SEEKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
