// `Stoneforge Acolyte` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STONEFORGE_ACOLYTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STONEFORGE_ACOLYTE, "Cohort — {T}, Tap an untapped Ally you control: Look at the top four cards of your library. You may reveal an Equipment card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");

const VOCAB_A0 = vocabularyEffects("Look at the top four cards of your library. You may reveal an Equipment card from among them and put it into your hand. Put the rest on the bottom of your library in any order.", STONEFORGE_ACOLYTE.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top four cards of your library. You may reveal an Equipment card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");

export const STONEFORGE_ACOLYTE_SCRIPT: CardScript = {
  oracleId: STONEFORGE_ACOLYTE.oracleId,
  name: STONEFORGE_ACOLYTE.name,
  activated: [
    {
      ref: `${STONEFORGE_ACOLYTE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
