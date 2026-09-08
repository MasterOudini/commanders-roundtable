// `Wayfarer's Bauble` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAYFARER_S_BAUBLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAYFARER_S_BAUBLE, "{2}, {T}, Sacrifice this artifact: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.", WAYFARER_S_BAUBLE.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.");

export const WAYFARERS_BAUBLE_SCRIPT: CardScript = {
  oracleId: WAYFARER_S_BAUBLE.oracleId,
  name: WAYFARER_S_BAUBLE.name,
  activated: [
    {
      ref: `${WAYFARER_S_BAUBLE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
