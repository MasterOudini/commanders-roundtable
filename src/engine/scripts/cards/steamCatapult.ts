// `Steam Catapult` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEAM_CATAPULT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEAM_CATAPULT, "{T}: Destroy target tapped creature. Activate only during your turn, before attackers are declared.");

const VOCAB_A0 = vocabularyEffects("Destroy target tapped creature.", STEAM_CATAPULT.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target tapped creature.");

export const STEAM_CATAPULT_SCRIPT: CardScript = {
  oracleId: STEAM_CATAPULT.oracleId,
  name: STEAM_CATAPULT.name,
  activated: [
    {
      ref: `${STEAM_CATAPULT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
