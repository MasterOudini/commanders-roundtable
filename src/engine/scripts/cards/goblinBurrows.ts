// `Goblin Burrows` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_BURROWS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_BURROWS, "{T}: Add {C}.\n{1}{R}, {T}: Target Goblin creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target Goblin creature gets +2/+0 until end of turn.", GOBLIN_BURROWS.name);
const VOCAB_T_A1 = vocabularyTargets("Target Goblin creature gets +2/+0 until end of turn.");

export const GOBLIN_BURROWS_SCRIPT: CardScript = {
  oracleId: GOBLIN_BURROWS.oracleId,
  name: GOBLIN_BURROWS.name,
  activated: [
    {
      ref: `${GOBLIN_BURROWS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
