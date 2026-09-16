// `Skinbrand Goblin` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKINBRAND_GOBLIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKINBRAND_GOBLIN, "Bloodrush — {R}, Discard this card: Target attacking creature gets +2/+1 until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target attacking creature gets +2/+1 until end of turn.", SKINBRAND_GOBLIN.name);
const VOCAB_T_A0 = vocabularyTargets("Target attacking creature gets +2/+1 until end of turn.");

export const SKINBRAND_GOBLIN_SCRIPT: CardScript = {
  oracleId: SKINBRAND_GOBLIN.oracleId,
  name: SKINBRAND_GOBLIN.name,
  activated: [
    {
      ref: `${SKINBRAND_GOBLIN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
