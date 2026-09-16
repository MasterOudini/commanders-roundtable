// `Jace Beleren` - an activation vocab, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JACE_BELEREN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JACE_BELEREN, "+2: Each player draws a card.\n−1: Target player draws a card.\n−10: Target player mills twenty cards.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Each player draws a card.", JACE_BELEREN.name);
const VOCAB_T_A0 = vocabularyTargets("Each player draws a card.");
const VOCAB_A1 = vocabularyEffects("Target player draws a card.", JACE_BELEREN.name);
const VOCAB_T_A1 = vocabularyTargets("Target player draws a card.");
const VOCAB_A2 = vocabularyEffects("Target player mills twenty cards.", JACE_BELEREN.name);
const VOCAB_T_A2 = vocabularyTargets("Target player mills twenty cards.");

export const JACE_BELEREN_SCRIPT: CardScript = {
  oracleId: JACE_BELEREN.oracleId,
  name: JACE_BELEREN.name,
  activated: [
    {
      ref: `${JACE_BELEREN.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${JACE_BELEREN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${JACE_BELEREN.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
