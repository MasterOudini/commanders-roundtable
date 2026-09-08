// `Bant Panorama` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BANT_PANORAMA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BANT_PANORAMA, "{T}: Add {C}.\n{1}, {T}, Sacrifice this land: Search your library for a basic Forest, Plains, or Island card, put it onto the battlefield tapped, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Search your library for a basic Forest, Plains, or Island card, put it onto the battlefield tapped, then shuffle.", BANT_PANORAMA.name);
const VOCAB_T_A1 = vocabularyTargets("Search your library for a basic Forest, Plains, or Island card, put it onto the battlefield tapped, then shuffle.");

export const BANT_PANORAMA_SCRIPT: CardScript = {
  oracleId: BANT_PANORAMA.oracleId,
  name: BANT_PANORAMA.name,
  activated: [
    {
      ref: `${BANT_PANORAMA.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
