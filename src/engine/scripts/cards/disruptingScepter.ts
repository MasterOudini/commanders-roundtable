// `Disrupting Scepter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DISRUPTING_SCEPTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DISRUPTING_SCEPTER, "{3}, {T}: Target player discards a card. Activate only during your turn.");

const VOCAB_A0 = vocabularyEffects("Target player discards a card.", DISRUPTING_SCEPTER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards a card.");

export const DISRUPTING_SCEPTER_SCRIPT: CardScript = {
  oracleId: DISRUPTING_SCEPTER.oracleId,
  name: DISRUPTING_SCEPTER.name,
  activated: [
    {
      ref: `${DISRUPTING_SCEPTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
