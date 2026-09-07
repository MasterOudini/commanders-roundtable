// `Liliana's Steward` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LILIANA_S_STEWARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LILIANA_S_STEWARD, "{T}, Sacrifice this creature: Target opponent discards a card. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Target opponent discards a card.", LILIANA_S_STEWARD.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent discards a card.");

export const LILIANAS_STEWARD_SCRIPT: CardScript = {
  oracleId: LILIANA_S_STEWARD.oracleId,
  name: LILIANA_S_STEWARD.name,
  activated: [
    {
      ref: `${LILIANA_S_STEWARD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
