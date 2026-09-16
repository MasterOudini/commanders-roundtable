// `Dive Bomber` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIVE_BOMBER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIVE_BOMBER, "Flying\n{T}, Sacrifice this creature: It deals 2 damage to target attacking or blocking creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 2 damage to target attacking or blocking creature.", DIVE_BOMBER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 2 damage to target attacking or blocking creature.");

export const DIVE_BOMBER_SCRIPT: CardScript = {
  oracleId: DIVE_BOMBER.oracleId,
  name: DIVE_BOMBER.name,
  activated: [
    {
      ref: `${DIVE_BOMBER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
