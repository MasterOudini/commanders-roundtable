// `Drowned Rusalka` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DROWNED_RUSALKA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DROWNED_RUSALKA, "{U}, Sacrifice a creature: Discard a card, then draw a card.");

const VOCAB_A0 = vocabularyEffects("Discard a card, then draw a card.", DROWNED_RUSALKA.name);
const VOCAB_T_A0 = vocabularyTargets("Discard a card, then draw a card.");

export const DROWNED_RUSALKA_SCRIPT: CardScript = {
  oracleId: DROWNED_RUSALKA.oracleId,
  name: DROWNED_RUSALKA.name,
  activated: [
    {
      ref: `${DROWNED_RUSALKA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
