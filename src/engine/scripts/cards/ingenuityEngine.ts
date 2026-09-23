// `Ingenuity Engine` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INGENUITY_ENGINE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INGENUITY_ENGINE, "Cascade (When you cast this spell, exile cards from the top of your library until you exile a nonland card that costs less. You may cast it without paying its mana cost. Put the exiled cards on the bottom in a random order.)\n{1}, {T}, Sacrifice an artifact: Return target artifact you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target artifact you control to its owner's hand.", INGENUITY_ENGINE.name);
const VOCAB_T_A0 = vocabularyTargets("Return target artifact you control to its owner's hand.");

export const INGENUITY_ENGINE_SCRIPT: CardScript = {
  oracleId: INGENUITY_ENGINE.oracleId,
  name: INGENUITY_ENGINE.name,
  activated: [
    {
      ref: `${INGENUITY_ENGINE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
