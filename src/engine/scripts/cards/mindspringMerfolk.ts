// `Mindspring Merfolk` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MINDSPRING_MERFOLK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MINDSPRING_MERFOLK, "Exhaust — {X}{U}{U}, {T}: Draw X cards. Put a +1/+1 counter on each Merfolk creature you control. (Activate each exhaust ability only once.)");

const VOCAB_A0 = vocabularyEffects("Draw X cards. Put a +1/+1 counter on each Merfolk creature you control.", MINDSPRING_MERFOLK.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("Draw X cards. Put a +1/+1 counter on each Merfolk creature you control.");

export const MINDSPRING_MERFOLK_SCRIPT: CardScript = {
  oracleId: MINDSPRING_MERFOLK.oracleId,
  name: MINDSPRING_MERFOLK.name,
  activated: [
    {
      ref: `${MINDSPRING_MERFOLK.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
