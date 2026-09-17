// `Ally Encampment` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALLY_ENCAMPMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALLY_ENCAMPMENT, "{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast an Ally spell.\n{1}, {T}, Sacrifice this land: Return target Ally you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Return target Ally you control to its owner's hand.", ALLY_ENCAMPMENT.name);
const VOCAB_T_A2 = vocabularyTargets("Return target Ally you control to its owner's hand.");

export const ALLY_ENCAMPMENT_SCRIPT: CardScript = {
  oracleId: ALLY_ENCAMPMENT.oracleId,
  name: ALLY_ENCAMPMENT.name,
  activated: [
    {
      ref: `${ALLY_ENCAMPMENT.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
