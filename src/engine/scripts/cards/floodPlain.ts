// `Flood Plain` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLOOD_PLAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLOOD_PLAIN, "This land enters tapped.\n{T}, Sacrifice this land: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.", FLOOD_PLAIN.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.");

export const FLOOD_PLAIN_SCRIPT: CardScript = {
  oracleId: FLOOD_PLAIN.oracleId,
  name: FLOOD_PLAIN.name,
  activated: [
    {
      ref: `${FLOOD_PLAIN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
