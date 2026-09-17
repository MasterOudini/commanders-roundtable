// `Myr Propagator` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MYR_PROPAGATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MYR_PROPAGATOR, "{3}, {T}: Create a token that's a copy of this creature.");

const VOCAB_A0 = vocabularyEffects("Create a token that's a copy of this creature.", MYR_PROPAGATOR.name);
const VOCAB_T_A0 = vocabularyTargets("Create a token that's a copy of this creature.");

export const MYR_PROPAGATOR_SCRIPT: CardScript = {
  oracleId: MYR_PROPAGATOR.oracleId,
  name: MYR_PROPAGATOR.name,
  activated: [
    {
      ref: `${MYR_PROPAGATOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
