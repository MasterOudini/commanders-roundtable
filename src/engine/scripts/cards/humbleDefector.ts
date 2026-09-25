// `Humble Defector` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HUMBLE_DEFECTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HUMBLE_DEFECTOR, "{T}: Draw two cards. Target opponent gains control of this creature. Activate only during your turn.");

const VOCAB_A0 = vocabularyEffects("Draw two cards. Target opponent gains control of this creature.", HUMBLE_DEFECTOR.name);
const VOCAB_T_A0 = vocabularyTargets("Draw two cards. Target opponent gains control of this creature.");

export const HUMBLE_DEFECTOR_SCRIPT: CardScript = {
  oracleId: HUMBLE_DEFECTOR.oracleId,
  name: HUMBLE_DEFECTOR.name,
  activated: [
    {
      ref: `${HUMBLE_DEFECTOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
