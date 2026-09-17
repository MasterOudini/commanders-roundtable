// `Goblin Taskmaster` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_TASKMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_TASKMASTER, "{1}{R}: Target Goblin creature gets +1/+0 until end of turn.\nMorph {R} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target Goblin creature gets +1/+0 until end of turn.", GOBLIN_TASKMASTER.name);
const VOCAB_T_A0 = vocabularyTargets("Target Goblin creature gets +1/+0 until end of turn.");

export const GOBLIN_TASKMASTER_SCRIPT: CardScript = {
  oracleId: GOBLIN_TASKMASTER.oracleId,
  name: GOBLIN_TASKMASTER.name,
  activated: [
    {
      ref: `${GOBLIN_TASKMASTER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
