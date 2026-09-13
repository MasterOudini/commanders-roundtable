// `Gnawing Zombie` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GNAWING_ZOMBIE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GNAWING_ZOMBIE, "{1}{B}, Sacrifice a creature: Target player loses 1 life and you gain 1 life.");

const VOCAB_A0 = vocabularyEffects("Target player loses 1 life and you gain 1 life.", GNAWING_ZOMBIE.name);
const VOCAB_T_A0 = vocabularyTargets("Target player loses 1 life and you gain 1 life.");

export const GNAWING_ZOMBIE_SCRIPT: CardScript = {
  oracleId: GNAWING_ZOMBIE.oracleId,
  name: GNAWING_ZOMBIE.name,
  activated: [
    {
      ref: `${GNAWING_ZOMBIE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
