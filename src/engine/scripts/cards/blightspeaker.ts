// `Blightspeaker` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIGHTSPEAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLIGHTSPEAKER, "{T}: Target player loses 1 life.\n{4}, {T}: Search your library for a Rebel permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player loses 1 life.", BLIGHTSPEAKER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player loses 1 life.");
const VOCAB_A1 = vocabularyEffects("Search your library for a Rebel permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.", BLIGHTSPEAKER.name);
const VOCAB_T_A1 = vocabularyTargets("Search your library for a Rebel permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.");

export const BLIGHTSPEAKER_SCRIPT: CardScript = {
  oracleId: BLIGHTSPEAKER.oracleId,
  name: BLIGHTSPEAKER.name,
  activated: [
    {
      ref: `${BLIGHTSPEAKER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${BLIGHTSPEAKER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
