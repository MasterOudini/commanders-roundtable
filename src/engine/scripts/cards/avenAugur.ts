// `Aven Augur` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVEN_AUGUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVEN_AUGUR, "Flying\nSacrifice this creature: Return up to two target creatures to their owners' hands. Activate only during your upkeep.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return up to two target creatures to their owners' hands.", AVEN_AUGUR.name);
const VOCAB_T_A0 = vocabularyTargets("Return up to two target creatures to their owners' hands.");

export const AVEN_AUGUR_SCRIPT: CardScript = {
  oracleId: AVEN_AUGUR.oracleId,
  name: AVEN_AUGUR.name,
  activated: [
    {
      ref: `${AVEN_AUGUR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
