// `Ajani, Adversary of Tyrants` - an activation vocab, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AJANI_ADVERSARY_OF_TYRANTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AJANI_ADVERSARY_OF_TYRANTS, "+1: Put a +1/+1 counter on each of up to two target creatures.\n−2: Return target creature card with mana value 2 or less from your graveyard to the battlefield.\n−7: You get an emblem with \"At the beginning of your end step, create three 1/1 white Cat creature tokens with lifelink.\"");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on each of up to two target creatures.", AJANI_ADVERSARY_OF_TYRANTS.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on each of up to two target creatures.");
const VOCAB_A1 = vocabularyEffects("Return target creature card with mana value 2 or less from your graveyard to the battlefield.", AJANI_ADVERSARY_OF_TYRANTS.name);
const VOCAB_T_A1 = vocabularyTargets("Return target creature card with mana value 2 or less from your graveyard to the battlefield.");
const VOCAB_A2 = vocabularyEffects("You get an emblem with \"At the beginning of your end step, create three 1/1 white Cat creature tokens with lifelink.\"", AJANI_ADVERSARY_OF_TYRANTS.name);
const VOCAB_T_A2 = vocabularyTargets("You get an emblem with \"At the beginning of your end step, create three 1/1 white Cat creature tokens with lifelink.\"");

export const AJANI_ADVERSARY_OF_TYRANTS_SCRIPT: CardScript = {
  oracleId: AJANI_ADVERSARY_OF_TYRANTS.oracleId,
  name: AJANI_ADVERSARY_OF_TYRANTS.name,
  activated: [
    {
      ref: `${AJANI_ADVERSARY_OF_TYRANTS.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${AJANI_ADVERSARY_OF_TYRANTS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${AJANI_ADVERSARY_OF_TYRANTS.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
