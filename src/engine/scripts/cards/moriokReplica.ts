// `Moriok Replica` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MORIOK_REPLICA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MORIOK_REPLICA, "{1}{B}, Sacrifice this creature: You draw two cards and you lose 2 life.");

const VOCAB_A0 = vocabularyEffects("You draw two cards and you lose 2 life.", MORIOK_REPLICA.name);
const VOCAB_T_A0 = vocabularyTargets("You draw two cards and you lose 2 life.");

export const MORIOK_REPLICA_SCRIPT: CardScript = {
  oracleId: MORIOK_REPLICA.oracleId,
  name: MORIOK_REPLICA.name,
  activated: [
    {
      ref: `${MORIOK_REPLICA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
