// `Feldon's Cane` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FELDON_S_CANE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FELDON_S_CANE, "{T}, Exile this artifact: Shuffle your graveyard into your library.");

const VOCAB_A0 = vocabularyEffects("Shuffle your graveyard into your library.", FELDON_S_CANE.name);
const VOCAB_T_A0 = vocabularyTargets("Shuffle your graveyard into your library.");

export const FELDONS_CANE_SCRIPT: CardScript = {
  oracleId: FELDON_S_CANE.oracleId,
  name: FELDON_S_CANE.name,
  activated: [
    {
      ref: `${FELDON_S_CANE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
