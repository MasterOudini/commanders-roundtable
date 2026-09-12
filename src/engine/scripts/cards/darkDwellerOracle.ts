// `Dark-Dweller Oracle` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARK_DWELLER_ORACLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARK_DWELLER_ORACLE, "{1}, Sacrifice a creature: Exile the top card of your library. You may play that card this turn. (You still pay its costs. You can play a land this way only if you have an available land play remaining.)");

const VOCAB_A0 = vocabularyEffects("Exile the top card of your library. You may play that card this turn.", DARK_DWELLER_ORACLE.name);
const VOCAB_T_A0 = vocabularyTargets("Exile the top card of your library. You may play that card this turn.");

export const DARK_DWELLER_ORACLE_SCRIPT: CardScript = {
  oracleId: DARK_DWELLER_ORACLE.oracleId,
  name: DARK_DWELLER_ORACLE.name,
  activated: [
    {
      ref: `${DARK_DWELLER_ORACLE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
