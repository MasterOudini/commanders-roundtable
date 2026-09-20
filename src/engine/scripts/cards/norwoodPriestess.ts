// `Norwood Priestess` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NORWOOD_PRIESTESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NORWOOD_PRIESTESS, "{T}: You may put a green creature card from your hand onto the battlefield. Activate only during your turn, before attackers are declared.");

const VOCAB_A0 = vocabularyEffects("You may put a green creature card from your hand onto the battlefield.", NORWOOD_PRIESTESS.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a green creature card from your hand onto the battlefield.");

export const NORWOOD_PRIESTESS_SCRIPT: CardScript = {
  oracleId: NORWOOD_PRIESTESS.oracleId,
  name: NORWOOD_PRIESTESS.name,
  activated: [
    {
      ref: `${NORWOOD_PRIESTESS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
