// `Rag Dealer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAG_DEALER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAG_DEALER, "{2}{B}, {T}: Exile up to three target cards from a single graveyard.");

const VOCAB_A0 = vocabularyEffects("Exile up to three target cards from a single graveyard.", RAG_DEALER.name);
const VOCAB_T_A0 = vocabularyTargets("Exile up to three target cards from a single graveyard.");

export const RAG_DEALER_SCRIPT: CardScript = {
  oracleId: RAG_DEALER.oracleId,
  name: RAG_DEALER.name,
  activated: [
    {
      ref: `${RAG_DEALER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
