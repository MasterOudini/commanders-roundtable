// `Hallowed Ground` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HALLOWED_GROUND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HALLOWED_GROUND, "{W}{W}: Return target nonsnow land you control to its owner's hand.");

const VOCAB_A0 = vocabularyEffects("Return target nonsnow land you control to its owner's hand.", HALLOWED_GROUND.name);
const VOCAB_T_A0 = vocabularyTargets("Return target nonsnow land you control to its owner's hand.");

export const HALLOWED_GROUND_SCRIPT: CardScript = {
  oracleId: HALLOWED_GROUND.oracleId,
  name: HALLOWED_GROUND.name,
  activated: [
    {
      ref: `${HALLOWED_GROUND.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
