// `Xiahou Dun, the One-Eyed` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { XIAHOU_DUN_THE_ONE_EYED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(XIAHOU_DUN_THE_ONE_EYED, "Horsemanship (This creature can't be blocked except by creatures with horsemanship.)\nSacrifice Xiahou Dun: Return target black card from your graveyard to your hand. Activate only during your turn, before attackers are declared.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target black card from your graveyard to your hand.", XIAHOU_DUN_THE_ONE_EYED.name);
const VOCAB_T_A0 = vocabularyTargets("Return target black card from your graveyard to your hand.");

export const XIAHOU_DUN_THE_ONE_EYED_SCRIPT: CardScript = {
  oracleId: XIAHOU_DUN_THE_ONE_EYED.oracleId,
  name: XIAHOU_DUN_THE_ONE_EYED.name,
  activated: [
    {
      ref: `${XIAHOU_DUN_THE_ONE_EYED.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
