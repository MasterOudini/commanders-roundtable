// `Horror of Horrors` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HORROR_OF_HORRORS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HORROR_OF_HORRORS, "Sacrifice a Swamp: Regenerate target black creature. (The next time that creature would be destroyed this turn, instead tap it, remove it from combat, and heal all damage on it.)");

const VOCAB_A0 = vocabularyEffects("Regenerate target black creature.", HORROR_OF_HORRORS.name);
const VOCAB_T_A0 = vocabularyTargets("Regenerate target black creature.");

export const HORROR_OF_HORRORS_SCRIPT: CardScript = {
  oracleId: HORROR_OF_HORRORS.oracleId,
  name: HORROR_OF_HORRORS.name,
  activated: [
    {
      ref: `${HORROR_OF_HORRORS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
