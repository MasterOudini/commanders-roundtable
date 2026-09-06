// `Clock of Omens` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLOCK_OF_OMENS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLOCK_OF_OMENS, "Tap two untapped artifacts you control: Untap target artifact.");

const VOCAB_A0 = vocabularyEffects("Untap target artifact.", CLOCK_OF_OMENS.name);
const VOCAB_T_A0 = vocabularyTargets("Untap target artifact.");

export const CLOCK_OF_OMENS_SCRIPT: CardScript = {
  oracleId: CLOCK_OF_OMENS.oracleId,
  name: CLOCK_OF_OMENS.name,
  activated: [
    {
      ref: `${CLOCK_OF_OMENS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
