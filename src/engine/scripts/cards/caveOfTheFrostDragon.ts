// `Cave of the Frost Dragon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAVE_OF_THE_FROST_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAVE_OF_THE_FROST_DRAGON, "If you control two or more other lands, this land enters tapped.\n{T}: Add {W}.\n{4}{W}: This land becomes a 3/4 white Dragon creature with flying until end of turn. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 3/4 white Dragon creature with flying until end of turn. It's still a land.", CAVE_OF_THE_FROST_DRAGON.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 3/4 white Dragon creature with flying until end of turn. It's still a land.");

export const CAVE_OF_THE_FROST_DRAGON_SCRIPT: CardScript = {
  oracleId: CAVE_OF_THE_FROST_DRAGON.oracleId,
  name: CAVE_OF_THE_FROST_DRAGON.name,
  activated: [
    {
      ref: `${CAVE_OF_THE_FROST_DRAGON.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
