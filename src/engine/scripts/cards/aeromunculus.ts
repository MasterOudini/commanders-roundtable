// `Aeromunculus` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AEROMUNCULUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AEROMUNCULUS, "Flying\n{2}{G}{U}: Adapt 1. (If this creature has no +1/+1 counters on it, put a +1/+1 counter on it.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Adapt 1.", AEROMUNCULUS.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 1.");

export const AEROMUNCULUS_SCRIPT: CardScript = {
  oracleId: AEROMUNCULUS.oracleId,
  name: AEROMUNCULUS.name,
  activated: [
    {
      ref: `${AEROMUNCULUS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
