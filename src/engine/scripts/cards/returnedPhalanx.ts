// `Returned Phalanx` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RETURNED_PHALANX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RETURNED_PHALANX, "Defender\n{1}{U}: This creature can attack this turn as though it didn't have defender.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ can attack this turn as though it didn't have defender.", RETURNED_PHALANX.name);
const VOCAB_T_A0 = vocabularyTargets("~ can attack this turn as though it didn't have defender.");

export const RETURNED_PHALANX_SCRIPT: CardScript = {
  oracleId: RETURNED_PHALANX.oracleId,
  name: RETURNED_PHALANX.name,
  activated: [
    {
      ref: `${RETURNED_PHALANX.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
