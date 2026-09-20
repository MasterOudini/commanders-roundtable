// `Planebound Accomplice` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PLANEBOUND_ACCOMPLICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PLANEBOUND_ACCOMPLICE, "{R}: You may put a planeswalker card from your hand onto the battlefield. Sacrifice it at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("You may put a planeswalker card from your hand onto the battlefield. Sacrifice it at the beginning of the next end step.", PLANEBOUND_ACCOMPLICE.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a planeswalker card from your hand onto the battlefield. Sacrifice it at the beginning of the next end step.");

export const PLANEBOUND_ACCOMPLICE_SCRIPT: CardScript = {
  oracleId: PLANEBOUND_ACCOMPLICE.oracleId,
  name: PLANEBOUND_ACCOMPLICE.name,
  activated: [
    {
      ref: `${PLANEBOUND_ACCOMPLICE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
