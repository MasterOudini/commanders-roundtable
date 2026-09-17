// `Icatian Lieutenant` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICATIAN_LIEUTENANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ICATIAN_LIEUTENANT, "{1}{W}: Target Soldier creature gets +1/+0 until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target Soldier creature gets +1/+0 until end of turn.", ICATIAN_LIEUTENANT.name);
const VOCAB_T_A0 = vocabularyTargets("Target Soldier creature gets +1/+0 until end of turn.");

export const ICATIAN_LIEUTENANT_SCRIPT: CardScript = {
  oracleId: ICATIAN_LIEUTENANT.oracleId,
  name: ICATIAN_LIEUTENANT.name,
  activated: [
    {
      ref: `${ICATIAN_LIEUTENANT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
