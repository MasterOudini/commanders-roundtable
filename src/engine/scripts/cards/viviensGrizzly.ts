// `Vivien's Grizzly` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIVIEN_S_GRIZZLY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIVIEN_S_GRIZZLY, "{3}{G}: Look at the top card of your library. If it's a creature or planeswalker card, you may reveal it and put it into your hand. If you don't put the card into your hand, put it on the bottom of your library.");

const VOCAB_A0 = vocabularyEffects("Look at the top card of your library. If it's a creature or planeswalker card, you may reveal it and put it into your hand. If you don't put the card into your hand, put it on the bottom of your library.", VIVIEN_S_GRIZZLY.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top card of your library. If it's a creature or planeswalker card, you may reveal it and put it into your hand. If you don't put the card into your hand, put it on the bottom of your library.");

export const VIVIENS_GRIZZLY_SCRIPT: CardScript = {
  oracleId: VIVIEN_S_GRIZZLY.oracleId,
  name: VIVIEN_S_GRIZZLY.name,
  activated: [
    {
      ref: `${VIVIEN_S_GRIZZLY.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
