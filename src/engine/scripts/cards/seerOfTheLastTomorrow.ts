// `Seer of the Last Tomorrow` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEER_OF_THE_LAST_TOMORROW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEER_OF_THE_LAST_TOMORROW, "{U}, {T}, Discard a card: Target player mills three cards.");

const VOCAB_A0 = vocabularyEffects("Target player mills three cards.", SEER_OF_THE_LAST_TOMORROW.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills three cards.");

export const SEER_OF_THE_LAST_TOMORROW_SCRIPT: CardScript = {
  oracleId: SEER_OF_THE_LAST_TOMORROW.oracleId,
  name: SEER_OF_THE_LAST_TOMORROW.name,
  activated: [
    {
      ref: `${SEER_OF_THE_LAST_TOMORROW.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
