// `Cabal Inquisitor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CABAL_INQUISITOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CABAL_INQUISITOR, "Threshold — {1}{B}, {T}, Exile two cards from your graveyard: Target player discards a card. Activate only as a sorcery and only if there are seven or more cards in your graveyard.");

const VOCAB_A0 = vocabularyEffects("Target player discards a card.", CABAL_INQUISITOR.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards a card.");

export const CABAL_INQUISITOR_SCRIPT: CardScript = {
  oracleId: CABAL_INQUISITOR.oracleId,
  name: CABAL_INQUISITOR.name,
  activated: [
    {
      ref: `${CABAL_INQUISITOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
