// `Ring of Gix` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RING_OF_GIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RING_OF_GIX, "Echo {3} (At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.)\n{1}, {T}: Tap target artifact, creature, or land.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Tap target artifact, creature, or land.", RING_OF_GIX.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target artifact, creature, or land.");

export const RING_OF_GIX_SCRIPT: CardScript = {
  oracleId: RING_OF_GIX.oracleId,
  name: RING_OF_GIX.name,
  activated: [
    {
      ref: `${RING_OF_GIX.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
