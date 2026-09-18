// `Memorial to Unity` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MEMORIAL_TO_UNITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MEMORIAL_TO_UNITY, "This land enters tapped.\n{T}: Add {G}.\n{2}{G}, {T}, Sacrifice this land: Look at the top five cards of your library. You may reveal a creature card from among them and put it into your hand. Then put the rest on the bottom of your library in a random order.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Look at the top five cards of your library. You may reveal a creature card from among them and put it into your hand. Then put the rest on the bottom of your library in a random order.", MEMORIAL_TO_UNITY.name);
const VOCAB_T_A1 = vocabularyTargets("Look at the top five cards of your library. You may reveal a creature card from among them and put it into your hand. Then put the rest on the bottom of your library in a random order.");

export const MEMORIAL_TO_UNITY_SCRIPT: CardScript = {
  oracleId: MEMORIAL_TO_UNITY.oracleId,
  name: MEMORIAL_TO_UNITY.name,
  activated: [
    {
      ref: `${MEMORIAL_TO_UNITY.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
