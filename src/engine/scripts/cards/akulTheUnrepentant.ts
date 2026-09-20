// `Akul the Unrepentant` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AKUL_THE_UNREPENTANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AKUL_THE_UNREPENTANT, "Flying, trample\nSacrifice three other creatures: You may put a creature card from your hand onto the battlefield. Activate only as a sorcery and only once each turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("You may put a creature card from your hand onto the battlefield.", AKUL_THE_UNREPENTANT.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a creature card from your hand onto the battlefield.");

export const AKUL_THE_UNREPENTANT_SCRIPT: CardScript = {
  oracleId: AKUL_THE_UNREPENTANT.oracleId,
  name: AKUL_THE_UNREPENTANT.name,
  activated: [
    {
      ref: `${AKUL_THE_UNREPENTANT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
