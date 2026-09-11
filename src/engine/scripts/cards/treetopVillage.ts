// `Treetop Village` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TREETOP_VILLAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TREETOP_VILLAGE, "This land enters tapped.\n{T}: Add {G}.\n{1}{G}: This land becomes a 3/3 green Ape creature with trample until end of turn. It's still a land. (It can deal excess combat damage to the player or planeswalker it's attacking.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 3/3 green Ape creature with trample until end of turn. It's still a land.", TREETOP_VILLAGE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 3/3 green Ape creature with trample until end of turn. It's still a land.");

export const TREETOP_VILLAGE_SCRIPT: CardScript = {
  oracleId: TREETOP_VILLAGE.oracleId,
  name: TREETOP_VILLAGE.name,
  activated: [
    {
      ref: `${TREETOP_VILLAGE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
