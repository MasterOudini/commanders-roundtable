// `Thrashing Wumpus` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THRASHING_WUMPUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THRASHING_WUMPUS, "{B}: This creature deals 1 damage to each creature and each player.");

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature and each player.", THRASHING_WUMPUS.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature and each player.");

export const THRASHING_WUMPUS_SCRIPT: CardScript = {
  oracleId: THRASHING_WUMPUS.oracleId,
  name: THRASHING_WUMPUS.name,
  activated: [
    {
      ref: `${THRASHING_WUMPUS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
