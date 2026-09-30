// `Hall of Tagsin` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HALL_OF_TAGSIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HALL_OF_TAGSIN, "{T}: Add {C}.\n{1}, {T}: Add one mana of any color.\n{4}, {T}: Create a tapped Powerstone token. (It's an artifact with \"{T}: Add {C}. This mana can't be spent to cast a nonartifact spell.\")");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Create a tapped Powerstone token.", HALL_OF_TAGSIN.name);
const VOCAB_T_A2 = vocabularyTargets("Create a tapped Powerstone token.");

export const HALL_OF_TAGSIN_SCRIPT: CardScript = {
  oracleId: HALL_OF_TAGSIN.oracleId,
  name: HALL_OF_TAGSIN.name,
  activated: [
    {
      ref: `${HALL_OF_TAGSIN.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
