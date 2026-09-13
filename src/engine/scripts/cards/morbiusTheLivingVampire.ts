// `Morbius the Living Vampire` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MORBIUS_THE_LIVING_VAMPIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MORBIUS_THE_LIVING_VAMPIRE, "Flying, vigilance, lifelink\n{U}{B}, Exile this card from your graveyard: Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.", MORBIUS_THE_LIVING_VAMPIRE.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.");

export const MORBIUS_THE_LIVING_VAMPIRE_SCRIPT: CardScript = {
  oracleId: MORBIUS_THE_LIVING_VAMPIRE.oracleId,
  name: MORBIUS_THE_LIVING_VAMPIRE.name,
  activated: [
    {
      ref: `${MORBIUS_THE_LIVING_VAMPIRE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
