// `Faerie Conclave` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAERIE_CONCLAVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAERIE_CONCLAVE, "This land enters tapped.\n{T}: Add {U}.\n{1}{U}: This land becomes a 2/1 blue Faerie creature with flying until end of turn. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 2/1 blue Faerie creature with flying until end of turn. It's still a land.", FAERIE_CONCLAVE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 2/1 blue Faerie creature with flying until end of turn. It's still a land.");

export const FAERIE_CONCLAVE_SCRIPT: CardScript = {
  oracleId: FAERIE_CONCLAVE.oracleId,
  name: FAERIE_CONCLAVE.name,
  activated: [
    {
      ref: `${FAERIE_CONCLAVE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
