// `Manifold Key` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MANIFOLD_KEY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANIFOLD_KEY, "{1}, {T}: Untap another target artifact.\n{3}, {T}: Target creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap another target artifact.", MANIFOLD_KEY.name);
const VOCAB_T_A0 = vocabularyTargets("Untap another target artifact.");
const VOCAB_A1 = vocabularyEffects("Target creature can't be blocked this turn.", MANIFOLD_KEY.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature can't be blocked this turn.");

export const MANIFOLD_KEY_SCRIPT: CardScript = {
  oracleId: MANIFOLD_KEY.oracleId,
  name: MANIFOLD_KEY.name,
  activated: [
    {
      ref: `${MANIFOLD_KEY.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${MANIFOLD_KEY.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
