// `Herald of the Sun` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HERALD_OF_THE_SUN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HERALD_OF_THE_SUN, "Flying\n{3}{W}: Put a +1/+1 counter on another target creature with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on another target creature with flying.", HERALD_OF_THE_SUN.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on another target creature with flying.");

export const HERALD_OF_THE_SUN_SCRIPT: CardScript = {
  oracleId: HERALD_OF_THE_SUN.oracleId,
  name: HERALD_OF_THE_SUN.name,
  activated: [
    {
      ref: `${HERALD_OF_THE_SUN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
