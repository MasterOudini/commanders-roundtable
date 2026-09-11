// `Siegebreaker Giant` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIEGEBREAKER_GIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIEGEBREAKER_GIANT, "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\n{3}{R}: Target creature can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't block this turn.", SIEGEBREAKER_GIANT.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this turn.");

export const SIEGEBREAKER_GIANT_SCRIPT: CardScript = {
  oracleId: SIEGEBREAKER_GIANT.oracleId,
  name: SIEGEBREAKER_GIANT.name,
  activated: [
    {
      ref: `${SIEGEBREAKER_GIANT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
