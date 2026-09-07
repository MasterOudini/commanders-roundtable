// `Stone Catapult` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STONE_CATAPULT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STONE_CATAPULT, "{T}: Destroy target tapped nonblack creature. Activate only during your turn, before attackers are declared.");

const VOCAB_A0 = vocabularyEffects("Destroy target tapped nonblack creature.", STONE_CATAPULT.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target tapped nonblack creature.");

export const STONE_CATAPULT_SCRIPT: CardScript = {
  oracleId: STONE_CATAPULT.oracleId,
  name: STONE_CATAPULT.name,
  activated: [
    {
      ref: `${STONE_CATAPULT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
