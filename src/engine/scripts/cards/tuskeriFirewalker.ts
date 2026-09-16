// `Tuskeri Firewalker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TUSKERI_FIREWALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TUSKERI_FIREWALKER, "Boast — {1}: Exile the top card of your library. You may play that card this turn. (Activate only if this creature attacked this turn and only once each turn.)");

const VOCAB_A0 = vocabularyEffects("Exile the top card of your library. You may play that card this turn.", TUSKERI_FIREWALKER.name);
const VOCAB_T_A0 = vocabularyTargets("Exile the top card of your library. You may play that card this turn.");

export const TUSKERI_FIREWALKER_SCRIPT: CardScript = {
  oracleId: TUSKERI_FIREWALKER.oracleId,
  name: TUSKERI_FIREWALKER.name,
  activated: [
    {
      ref: `${TUSKERI_FIREWALKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
