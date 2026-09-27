// `Frenetic Efreet` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FRENETIC_EFREET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FRENETIC_EFREET, "Flying\n{0}: Flip a coin. If you win the flip, this creature phases out. If you lose the flip, sacrifice this creature. (While it's phased out, it's treated as though it doesn't exist. It phases in before you untap during your next untap step.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Flip a coin. If you win the flip, this creature phases out. If you lose the flip, sacrifice this creature.", FRENETIC_EFREET.name);
const VOCAB_T_A0 = vocabularyTargets("Flip a coin. If you win the flip, this creature phases out. If you lose the flip, sacrifice this creature.");

export const FRENETIC_EFREET_SCRIPT: CardScript = {
  oracleId: FRENETIC_EFREET.oracleId,
  name: FRENETIC_EFREET.name,
  activated: [
    {
      ref: `${FRENETIC_EFREET.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
