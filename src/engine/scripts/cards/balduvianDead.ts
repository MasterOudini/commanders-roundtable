// `Balduvian Dead` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BALDUVIAN_DEAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BALDUVIAN_DEAD, "{2}{R}, Exile a creature card from your graveyard: Create a 3/1 black and red Graveborn creature token with haste. Sacrifice it at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("Create a 3/1 black and red Graveborn creature token with haste. Sacrifice it at the beginning of the next end step.", BALDUVIAN_DEAD.name);
const VOCAB_T_A0 = vocabularyTargets("Create a 3/1 black and red Graveborn creature token with haste. Sacrifice it at the beginning of the next end step.");

export const BALDUVIAN_DEAD_SCRIPT: CardScript = {
  oracleId: BALDUVIAN_DEAD.oracleId,
  name: BALDUVIAN_DEAD.name,
  activated: [
    {
      ref: `${BALDUVIAN_DEAD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
