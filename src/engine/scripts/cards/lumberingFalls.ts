// `Lumbering Falls` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LUMBERING_FALLS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LUMBERING_FALLS, "This land enters tapped.\n{T}: Add {G} or {U}.\n{2}{G}{U}: Until end of turn, this land becomes a 3/3 green and blue Elemental creature with hexproof. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Until end of turn, this land becomes a 3/3 green and blue Elemental creature with hexproof. It's still a land.", LUMBERING_FALLS.name);
const VOCAB_T_A1 = vocabularyTargets("Until end of turn, this land becomes a 3/3 green and blue Elemental creature with hexproof. It's still a land.");

export const LUMBERING_FALLS_SCRIPT: CardScript = {
  oracleId: LUMBERING_FALLS.oracleId,
  name: LUMBERING_FALLS.name,
  activated: [
    {
      ref: `${LUMBERING_FALLS.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
