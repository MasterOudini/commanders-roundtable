// `Order of Whiteclay` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORDER_OF_WHITECLAY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORDER_OF_WHITECLAY, "{1}{W}{W}, {Q}: Return target creature card with mana value 3 or less from your graveyard to the battlefield. ({Q} is the untap symbol.)");

const VOCAB_A0 = vocabularyEffects("Return target creature card with mana value 3 or less from your graveyard to the battlefield.", ORDER_OF_WHITECLAY.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature card with mana value 3 or less from your graveyard to the battlefield.");

export const ORDER_OF_WHITECLAY_SCRIPT: CardScript = {
  oracleId: ORDER_OF_WHITECLAY.oracleId,
  name: ORDER_OF_WHITECLAY.name,
  activated: [
    {
      ref: `${ORDER_OF_WHITECLAY.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
