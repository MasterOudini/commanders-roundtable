// `Soldier Replica` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOLDIER_REPLICA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOLDIER_REPLICA, "{1}{W}, Sacrifice this creature: It deals 3 damage to target attacking or blocking creature.");

const VOCAB_A0 = vocabularyEffects("~ deals 3 damage to target attacking or blocking creature.", SOLDIER_REPLICA.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 3 damage to target attacking or blocking creature.");

export const SOLDIER_REPLICA_SCRIPT: CardScript = {
  oracleId: SOLDIER_REPLICA.oracleId,
  name: SOLDIER_REPLICA.name,
  activated: [
    {
      ref: `${SOLDIER_REPLICA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
