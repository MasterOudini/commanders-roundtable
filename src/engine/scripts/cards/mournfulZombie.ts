// `Mournful Zombie` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOURNFUL_ZOMBIE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOURNFUL_ZOMBIE, "{W}, {T}: Target player gains 1 life.");

const VOCAB_A0 = vocabularyEffects("Target player gains 1 life.", MOURNFUL_ZOMBIE.name);
const VOCAB_T_A0 = vocabularyTargets("Target player gains 1 life.");

export const MOURNFUL_ZOMBIE_SCRIPT: CardScript = {
  oracleId: MOURNFUL_ZOMBIE.oracleId,
  name: MOURNFUL_ZOMBIE.name,
  activated: [
    {
      ref: `${MOURNFUL_ZOMBIE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
