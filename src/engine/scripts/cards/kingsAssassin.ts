// `King's Assassin` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KING_S_ASSASSIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KING_S_ASSASSIN, "{T}: Destroy target tapped creature. Activate only during your turn, before attackers are declared.");

const VOCAB_A0 = vocabularyEffects("Destroy target tapped creature.", KING_S_ASSASSIN.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target tapped creature.");

export const KINGS_ASSASSIN_SCRIPT: CardScript = {
  oracleId: KING_S_ASSASSIN.oracleId,
  name: KING_S_ASSASSIN.name,
  activated: [
    {
      ref: `${KING_S_ASSASSIN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
