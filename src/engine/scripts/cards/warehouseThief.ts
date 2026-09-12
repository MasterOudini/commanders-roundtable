// `Warehouse Thief` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAREHOUSE_THIEF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAREHOUSE_THIEF, "{2}, {T}, Sacrifice an artifact or creature: Exile the top card of your library. Until the end of your next turn, you may play that card.");

const VOCAB_A0 = vocabularyEffects("Exile the top card of your library. Until the end of your next turn, you may play that card.", WAREHOUSE_THIEF.name);
const VOCAB_T_A0 = vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.");

export const WAREHOUSE_THIEF_SCRIPT: CardScript = {
  oracleId: WAREHOUSE_THIEF.oracleId,
  name: WAREHOUSE_THIEF.name,
  activated: [
    {
      ref: `${WAREHOUSE_THIEF.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
