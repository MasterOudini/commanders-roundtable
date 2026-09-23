// `Gangrenous Zombies` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GANGRENOUS_ZOMBIES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GANGRENOUS_ZOMBIES, "{T}, Sacrifice this creature: This creature deals 1 damage to each creature and each player. If you control a snow Swamp, this creature deals 2 damage to each creature and each player instead.");

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature and each player. If you control a snow Swamp, this creature deals 2 damage to each creature and each player instead.", GANGRENOUS_ZOMBIES.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature and each player. If you control a snow Swamp, this creature deals 2 damage to each creature and each player instead.");

export const GANGRENOUS_ZOMBIES_SCRIPT: CardScript = {
  oracleId: GANGRENOUS_ZOMBIES.oracleId,
  name: GANGRENOUS_ZOMBIES.name,
  activated: [
    {
      ref: `${GANGRENOUS_ZOMBIES.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
