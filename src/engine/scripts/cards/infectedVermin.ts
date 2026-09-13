// `Infected Vermin` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INFECTED_VERMIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INFECTED_VERMIN, "{2}{B}: This creature deals 1 damage to each creature and each player.\nThreshold — {3}{B}: This creature deals 3 damage to each creature and each player. Activate only if there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature and each player.", INFECTED_VERMIN.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature and each player.");
const VOCAB_A1 = vocabularyEffects("~ deals 3 damage to each creature and each player.", INFECTED_VERMIN.name);
const VOCAB_T_A1 = vocabularyTargets("~ deals 3 damage to each creature and each player.");

export const INFECTED_VERMIN_SCRIPT: CardScript = {
  oracleId: INFECTED_VERMIN.oracleId,
  name: INFECTED_VERMIN.name,
  activated: [
    {
      ref: `${INFECTED_VERMIN.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${INFECTED_VERMIN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
