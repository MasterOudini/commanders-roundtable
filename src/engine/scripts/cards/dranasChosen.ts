// `Drana's Chosen` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRANA_S_CHOSEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRANA_S_CHOSEN, "Cohort — {T}, Tap an untapped Ally you control: Create a tapped 2/2 black Zombie creature token.");

const VOCAB_A0 = vocabularyEffects("Create a tapped 2/2 black Zombie creature token.", DRANA_S_CHOSEN.name);
const VOCAB_T_A0 = vocabularyTargets("Create a tapped 2/2 black Zombie creature token.");

export const DRANAS_CHOSEN_SCRIPT: CardScript = {
  oracleId: DRANA_S_CHOSEN.oracleId,
  name: DRANA_S_CHOSEN.name,
  activated: [
    {
      ref: `${DRANA_S_CHOSEN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
