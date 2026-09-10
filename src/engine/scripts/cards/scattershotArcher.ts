// `Scattershot Archer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCATTERSHOT_ARCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCATTERSHOT_ARCHER, "{T}: This creature deals 1 damage to each creature with flying.");

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature with flying.", SCATTERSHOT_ARCHER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature with flying.");

export const SCATTERSHOT_ARCHER_SCRIPT: CardScript = {
  oracleId: SCATTERSHOT_ARCHER.oracleId,
  name: SCATTERSHOT_ARCHER.name,
  activated: [
    {
      ref: `${SCATTERSHOT_ARCHER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
