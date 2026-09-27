// `Etched Oracle` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ETCHED_ORACLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ETCHED_ORACLE, "Sunburst (This creature enters with a +1/+1 counter on it for each color of mana spent to cast it.)\n{1}, Remove four +1/+1 counters from this creature: Target player draws three cards.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player draws three cards.", ETCHED_ORACLE.name);
const VOCAB_T_A0 = vocabularyTargets("Target player draws three cards.");

export const ETCHED_ORACLE_SCRIPT: CardScript = {
  oracleId: ETCHED_ORACLE.oracleId,
  name: ETCHED_ORACLE.name,
  activated: [
    {
      ref: `${ETCHED_ORACLE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
