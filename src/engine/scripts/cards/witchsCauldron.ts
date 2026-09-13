// `Witch's Cauldron` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WITCH_S_CAULDRON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WITCH_S_CAULDRON, "{1}{B}, {T}, Sacrifice a creature: You gain 1 life and draw a card.");

const VOCAB_A0 = vocabularyEffects("You gain 1 life and draw a card.", WITCH_S_CAULDRON.name);
const VOCAB_T_A0 = vocabularyTargets("You gain 1 life and draw a card.");

export const WITCHS_CAULDRON_SCRIPT: CardScript = {
  oracleId: WITCH_S_CAULDRON.oracleId,
  name: WITCH_S_CAULDRON.name,
  activated: [
    {
      ref: `${WITCH_S_CAULDRON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
