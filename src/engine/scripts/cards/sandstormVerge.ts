// `Sandstorm Verge` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SANDSTORM_VERGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SANDSTORM_VERGE, "{T}: Add {C}.\n{3}, {T}: Target creature can't block this turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target creature can't block this turn.", SANDSTORM_VERGE.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature can't block this turn.");

export const SANDSTORM_VERGE_SCRIPT: CardScript = {
  oracleId: SANDSTORM_VERGE.oracleId,
  name: SANDSTORM_VERGE.name,
  activated: [
    {
      ref: `${SANDSTORM_VERGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
