// `Consumptive Goo` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONSUMPTIVE_GOO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONSUMPTIVE_GOO, "{2}{B}{B}: Target creature gets -1/-1 until end of turn. Put a +1/+1 counter on this creature.");

const VOCAB_A0 = vocabularyEffects("Target creature gets -1/-1 until end of turn. Put a +1/+1 counter on ~.", CONSUMPTIVE_GOO.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature gets -1/-1 until end of turn. Put a +1/+1 counter on ~.");

export const CONSUMPTIVE_GOO_SCRIPT: CardScript = {
  oracleId: CONSUMPTIVE_GOO.oracleId,
  name: CONSUMPTIVE_GOO.name,
  activated: [
    {
      ref: `${CONSUMPTIVE_GOO.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
