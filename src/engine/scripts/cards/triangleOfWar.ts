// `Triangle of War` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRIANGLE_OF_WAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRIANGLE_OF_WAR, "{2}, Sacrifice this artifact: Target creature you control fights target creature an opponent controls. (Each deals damage equal to its power to the other.)");

const VOCAB_A0 = vocabularyEffects("Target creature you control fights target creature an opponent controls.", TRIANGLE_OF_WAR.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control fights target creature an opponent controls.");

export const TRIANGLE_OF_WAR_SCRIPT: CardScript = {
  oracleId: TRIANGLE_OF_WAR.oracleId,
  name: TRIANGLE_OF_WAR.name,
  activated: [
    {
      ref: `${TRIANGLE_OF_WAR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
