// `Mai, Jaded Edge` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAI_JADED_EDGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAI_JADED_EDGE, "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nExhaust — {3}: Put a double strike counter on Mai. (Activate each exhaust ability only once.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a double strike counter on ~.", MAI_JADED_EDGE.name);
const VOCAB_T_A0 = vocabularyTargets("Put a double strike counter on ~.");

export const MAI_JADED_EDGE_SCRIPT: CardScript = {
  oracleId: MAI_JADED_EDGE.oracleId,
  name: MAI_JADED_EDGE.name,
  activated: [
    {
      ref: `${MAI_JADED_EDGE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
