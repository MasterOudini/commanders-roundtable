// `Deserter's Disciple` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DESERTER_S_DISCIPLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DESERTER_S_DISCIPLE, "{T}: Another target creature you control with power 2 or less can't be blocked this turn.");

const VOCAB_A0 = vocabularyEffects("Another target creature you control with power 2 or less can't be blocked this turn.", DESERTER_S_DISCIPLE.name);
const VOCAB_T_A0 = vocabularyTargets("Another target creature you control with power 2 or less can't be blocked this turn.");

export const DESERTERS_DISCIPLE_SCRIPT: CardScript = {
  oracleId: DESERTER_S_DISCIPLE.oracleId,
  name: DESERTER_S_DISCIPLE.name,
  activated: [
    {
      ref: `${DESERTER_S_DISCIPLE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
