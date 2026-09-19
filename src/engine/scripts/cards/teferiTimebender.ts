// `Teferi, Timebender` - an activation vocab, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEFERI_TIMEBENDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TEFERI_TIMEBENDER, "+2: Untap up to one target artifact or creature.\n−3: You gain 2 life and draw two cards.\n−9: Take an extra turn after this one.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap up to one target artifact or creature.", TEFERI_TIMEBENDER.name);
const VOCAB_T_A0 = vocabularyTargets("Untap up to one target artifact or creature.");
const VOCAB_A1 = vocabularyEffects("You gain 2 life and draw two cards.", TEFERI_TIMEBENDER.name);
const VOCAB_T_A1 = vocabularyTargets("You gain 2 life and draw two cards.");
const VOCAB_A2 = vocabularyEffects("Take an extra turn after this one.", TEFERI_TIMEBENDER.name);
const VOCAB_T_A2 = vocabularyTargets("Take an extra turn after this one.");

export const TEFERI_TIMEBENDER_SCRIPT: CardScript = {
  oracleId: TEFERI_TIMEBENDER.oracleId,
  name: TEFERI_TIMEBENDER.name,
  activated: [
    {
      ref: `${TEFERI_TIMEBENDER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${TEFERI_TIMEBENDER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${TEFERI_TIMEBENDER.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
