// `Steelshaper Apprentice` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEELSHAPER_APPRENTICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEELSHAPER_APPRENTICE, "{W}, {T}, Return this creature to its owner's hand: Search your library for an Equipment card, reveal that card, put it into your hand, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for an Equipment card, reveal that card, put it into your hand, then shuffle.", STEELSHAPER_APPRENTICE.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for an Equipment card, reveal that card, put it into your hand, then shuffle.");

export const STEELSHAPER_APPRENTICE_SCRIPT: CardScript = {
  oracleId: STEELSHAPER_APPRENTICE.oracleId,
  name: STEELSHAPER_APPRENTICE.name,
  activated: [
    {
      ref: `${STEELSHAPER_APPRENTICE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
