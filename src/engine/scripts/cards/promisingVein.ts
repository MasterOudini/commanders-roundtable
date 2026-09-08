// `Promising Vein` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROMISING_VEIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROMISING_VEIN, "{T}: Add {C}.\n{1}, {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", PROMISING_VEIN.name);
const VOCAB_T_A1 = vocabularyTargets("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");

export const PROMISING_VEIN_SCRIPT: CardScript = {
  oracleId: PROMISING_VEIN.oracleId,
  name: PROMISING_VEIN.name,
  activated: [
    {
      ref: `${PROMISING_VEIN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
