// `Woodripper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WOODRIPPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WOODRIPPER, "Fading 3 (This creature enters with three fade counters on it. At the beginning of your upkeep, remove a fade counter from it. If you can't, sacrifice it.)\n{1}, Remove a fade counter from this creature: Destroy target artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target artifact.", WOODRIPPER.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact.");

export const WOODRIPPER_SCRIPT: CardScript = {
  oracleId: WOODRIPPER.oracleId,
  name: WOODRIPPER.name,
  activated: [
    {
      ref: `${WOODRIPPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
