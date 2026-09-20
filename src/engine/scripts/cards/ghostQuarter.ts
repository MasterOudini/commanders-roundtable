// `Ghost Quarter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOST_QUARTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHOST_QUARTER, "{T}: Add {C}.\n{T}, Sacrifice this land: Destroy target land. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Destroy target land. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.", GHOST_QUARTER.name);
const VOCAB_T_A1 = vocabularyTargets("Destroy target land. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.");

export const GHOST_QUARTER_SCRIPT: CardScript = {
  oracleId: GHOST_QUARTER.oracleId,
  name: GHOST_QUARTER.name,
  activated: [
    {
      ref: `${GHOST_QUARTER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
