// `Daily Bugle Newspaper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAILY_BUGLE_NEWSPAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAILY_BUGLE_NEWSPAPER, "{2}, {T}: Draw a card, then discard a card. Create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");

const VOCAB_A0 = vocabularyEffects("Draw a card, then discard a card. Create a Treasure token.", DAILY_BUGLE_NEWSPAPER.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card, then discard a card. Create a Treasure token.");

export const DAILY_BUGLE_NEWSPAPER_SCRIPT: CardScript = {
  oracleId: DAILY_BUGLE_NEWSPAPER.oracleId,
  name: DAILY_BUGLE_NEWSPAPER.name,
  activated: [
    {
      ref: `${DAILY_BUGLE_NEWSPAPER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
