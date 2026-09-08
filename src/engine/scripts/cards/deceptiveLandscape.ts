// `Deceptive Landscape` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DECEPTIVE_LANDSCAPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DECEPTIVE_LANDSCAPE, "{T}: Add {C}.\n{T}, Sacrifice this land: Search your library for a basic Plains, Swamp, or Forest card, put it onto the battlefield tapped, then shuffle.\nCycling {W}{B}{G} ({W}{B}{G}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Search your library for a basic Plains, Swamp, or Forest card, put it onto the battlefield tapped, then shuffle.", DECEPTIVE_LANDSCAPE.name);
const VOCAB_T_A1 = vocabularyTargets("Search your library for a basic Plains, Swamp, or Forest card, put it onto the battlefield tapped, then shuffle.");

export const DECEPTIVE_LANDSCAPE_SCRIPT: CardScript = {
  oracleId: DECEPTIVE_LANDSCAPE.oracleId,
  name: DECEPTIVE_LANDSCAPE.name,
  activated: [
    {
      ref: `${DECEPTIVE_LANDSCAPE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
