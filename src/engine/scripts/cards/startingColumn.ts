// `Starting Column` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STARTING_COLUMN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STARTING_COLUMN, "Start your engines! (If you have no speed, it starts at 1. It increases once on each of your turns when an opponent loses life. Max speed is 4.)\n{T}: Add one mana of any color.\nMax speed — {T}, Sacrifice this artifact: Draw two cards, then discard a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Draw two cards, then discard a card.", STARTING_COLUMN.name);
const VOCAB_T_A1 = vocabularyTargets("Draw two cards, then discard a card.");

export const STARTING_COLUMN_SCRIPT: CardScript = {
  oracleId: STARTING_COLUMN.oracleId,
  name: STARTING_COLUMN.name,
  activated: [
    {
      ref: `${STARTING_COLUMN.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
