// `Stuffed Bear` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STUFFED_BEAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STUFFED_BEAR, "{2}: This artifact becomes a 4/4 green Bear artifact creature until end of turn.");

const VOCAB_A0 = vocabularyEffects("~ becomes a 4/4 green Bear artifact creature until end of turn.", STUFFED_BEAR.name);
const VOCAB_T_A0 = vocabularyTargets("~ becomes a 4/4 green Bear artifact creature until end of turn.");

export const STUFFED_BEAR_SCRIPT: CardScript = {
  oracleId: STUFFED_BEAR.oracleId,
  name: STUFFED_BEAR.name,
  activated: [
    {
      ref: `${STUFFED_BEAR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
