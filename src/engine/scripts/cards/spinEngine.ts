// `Spin Engine` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIN_ENGINE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIN_ENGINE, "{R}: Target creature can't block this creature this turn.");

const VOCAB_A0 = vocabularyEffects("Target creature can't block this creature this turn.", SPIN_ENGINE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this creature this turn.");

export const SPIN_ENGINE_SCRIPT: CardScript = {
  oracleId: SPIN_ENGINE.oracleId,
  name: SPIN_ENGINE.name,
  activated: [
    {
      ref: `${SPIN_ENGINE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
