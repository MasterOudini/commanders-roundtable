// `Krosan Wayfarer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KROSAN_WAYFARER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROSAN_WAYFARER, "Sacrifice this creature: You may put a land card from your hand onto the battlefield.");

const VOCAB_A0 = vocabularyEffects("You may put a land card from your hand onto the battlefield.", KROSAN_WAYFARER.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a land card from your hand onto the battlefield.");

export const KROSAN_WAYFARER_SCRIPT: CardScript = {
  oracleId: KROSAN_WAYFARER.oracleId,
  name: KROSAN_WAYFARER.name,
  activated: [
    {
      ref: `${KROSAN_WAYFARER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
