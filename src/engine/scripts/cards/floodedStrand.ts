// `Flooded Strand` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLOODED_STRAND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLOODED_STRAND, "{T}, Pay 1 life, Sacrifice this land: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.", FLOODED_STRAND.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.");

export const FLOODED_STRAND_SCRIPT: CardScript = {
  oracleId: FLOODED_STRAND.oracleId,
  name: FLOODED_STRAND.name,
  activated: [
    {
      ref: `${FLOODED_STRAND.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
