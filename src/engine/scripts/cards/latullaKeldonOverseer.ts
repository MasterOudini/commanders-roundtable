// `Latulla, Keldon Overseer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LATULLA_KELDON_OVERSEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LATULLA_KELDON_OVERSEER, "{X}{R}, {T}, Discard two cards: Latulla deals X damage to any target.");

const VOCAB_A0 = vocabularyEffects("~ deals X damage to any target.", LATULLA_KELDON_OVERSEER.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("~ deals X damage to any target.");

export const LATULLA_KELDON_OVERSEER_SCRIPT: CardScript = {
  oracleId: LATULLA_KELDON_OVERSEER.oracleId,
  name: LATULLA_KELDON_OVERSEER.name,
  activated: [
    {
      ref: `${LATULLA_KELDON_OVERSEER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
