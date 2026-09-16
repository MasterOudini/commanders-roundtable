// `Draugr Recruiter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAUGR_RECRUITER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRAUGR_RECRUITER, "Boast — {3}{B}: Return target creature card from your graveyard to your hand. (Activate only if this creature attacked this turn and only once each turn.)");

const VOCAB_A0 = vocabularyEffects("Return target creature card from your graveyard to your hand.", DRAUGR_RECRUITER.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature card from your graveyard to your hand.");

export const DRAUGR_RECRUITER_SCRIPT: CardScript = {
  oracleId: DRAUGR_RECRUITER.oracleId,
  name: DRAUGR_RECRUITER.name,
  activated: [
    {
      ref: `${DRAUGR_RECRUITER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
