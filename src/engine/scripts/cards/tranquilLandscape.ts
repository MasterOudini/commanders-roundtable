// `Tranquil Landscape` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRANQUIL_LANDSCAPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRANQUIL_LANDSCAPE, "{T}: Add {C}.\n{T}, Sacrifice this land: Search your library for a basic Forest, Plains, or Island card, put it onto the battlefield tapped, then shuffle.\nCycling {G}{W}{U} ({G}{W}{U}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Search your library for a basic Forest, Plains, or Island card, put it onto the battlefield tapped, then shuffle.", TRANQUIL_LANDSCAPE.name);
const VOCAB_T_A1 = vocabularyTargets("Search your library for a basic Forest, Plains, or Island card, put it onto the battlefield tapped, then shuffle.");

export const TRANQUIL_LANDSCAPE_SCRIPT: CardScript = {
  oracleId: TRANQUIL_LANDSCAPE.oracleId,
  name: TRANQUIL_LANDSCAPE.name,
  activated: [
    {
      ref: `${TRANQUIL_LANDSCAPE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
