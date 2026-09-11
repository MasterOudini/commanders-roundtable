// `Forbidding Watchtower` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORBIDDING_WATCHTOWER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORBIDDING_WATCHTOWER, "This land enters tapped.\n{T}: Add {W}.\n{1}{W}: This land becomes a 1/5 white Soldier creature until end of turn. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 1/5 white Soldier creature until end of turn. It's still a land.", FORBIDDING_WATCHTOWER.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 1/5 white Soldier creature until end of turn. It's still a land.");

export const FORBIDDING_WATCHTOWER_SCRIPT: CardScript = {
  oracleId: FORBIDDING_WATCHTOWER.oracleId,
  name: FORBIDDING_WATCHTOWER.name,
  activated: [
    {
      ref: `${FORBIDDING_WATCHTOWER.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
