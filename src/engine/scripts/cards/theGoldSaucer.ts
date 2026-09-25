// `The Gold Saucer` - an activation vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_GOLD_SAUCER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(THE_GOLD_SAUCER, "{T}: Add {C}.\n{2}, {T}: Flip a coin. If you win the flip, create a Treasure token.\n{3}, {T}, Sacrifice two artifacts: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Flip a coin. If you win the flip, create a Treasure token.", THE_GOLD_SAUCER.name);
const VOCAB_T_A1 = vocabularyTargets("Flip a coin. If you win the flip, create a Treasure token.");

export const THE_GOLD_SAUCER_SCRIPT: CardScript = {
  oracleId: THE_GOLD_SAUCER.oracleId,
  name: THE_GOLD_SAUCER.name,
  activated: [
    {
      ref: `${THE_GOLD_SAUCER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${THE_GOLD_SAUCER.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
