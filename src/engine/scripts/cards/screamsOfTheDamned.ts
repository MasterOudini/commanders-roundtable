// `Screams of the Damned` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCREAMS_OF_THE_DAMNED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCREAMS_OF_THE_DAMNED, "{1}{B}, Exile a card from your graveyard: This enchantment deals 1 damage to each creature and each player.");

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature and each player.", SCREAMS_OF_THE_DAMNED.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature and each player.");

export const SCREAMS_OF_THE_DAMNED_SCRIPT: CardScript = {
  oracleId: SCREAMS_OF_THE_DAMNED.oracleId,
  name: SCREAMS_OF_THE_DAMNED.name,
  activated: [
    {
      ref: `${SCREAMS_OF_THE_DAMNED.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
