// `Orazca Relic` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORAZCA_RELIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORAZCA_RELIC, "Ascend (If you control ten or more permanents, you get the city's blessing for the rest of the game.)\n{T}: Add {C}.\n{T}, Sacrifice this artifact: You gain 3 life and draw a card. Activate only if you have the city's blessing.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("You gain 3 life and draw a card.", ORAZCA_RELIC.name);
const VOCAB_T_A1 = vocabularyTargets("You gain 3 life and draw a card.");

export const ORAZCA_RELIC_SCRIPT: CardScript = {
  oracleId: ORAZCA_RELIC.oracleId,
  name: ORAZCA_RELIC.name,
  activated: [
    {
      ref: `${ORAZCA_RELIC.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
