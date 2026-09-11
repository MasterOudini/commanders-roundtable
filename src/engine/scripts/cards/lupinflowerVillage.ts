// `Lupinflower Village` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LUPINFLOWER_VILLAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LUPINFLOWER_VILLAGE, "{T}: Add {C}.\n{T}: Add {W}. Spend this mana only to cast a creature spell.\n{1}{W}, {T}, Sacrifice this land: Look at the top six cards of your library. You may reveal a Bat, Bird, Mouse, or Rabbit card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Look at the top six cards of your library. You may reveal a Bat, Bird, Mouse, or Rabbit card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.", LUPINFLOWER_VILLAGE.name);
const VOCAB_T_A2 = vocabularyTargets("Look at the top six cards of your library. You may reveal a Bat, Bird, Mouse, or Rabbit card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

export const LUPINFLOWER_VILLAGE_SCRIPT: CardScript = {
  oracleId: LUPINFLOWER_VILLAGE.oracleId,
  name: LUPINFLOWER_VILLAGE.name,
  activated: [
    {
      ref: `${LUPINFLOWER_VILLAGE.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
