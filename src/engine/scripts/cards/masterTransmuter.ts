// `Master Transmuter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MASTER_TRANSMUTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MASTER_TRANSMUTER, "{U}, {T}, Return an artifact you control to its owner's hand: You may put an artifact card from your hand onto the battlefield.");

const VOCAB_A0 = vocabularyEffects("You may put an artifact card from your hand onto the battlefield.", MASTER_TRANSMUTER.name);
const VOCAB_T_A0 = vocabularyTargets("You may put an artifact card from your hand onto the battlefield.");

export const MASTER_TRANSMUTER_SCRIPT: CardScript = {
  oracleId: MASTER_TRANSMUTER.oracleId,
  name: MASTER_TRANSMUTER.name,
  activated: [
    {
      ref: `${MASTER_TRANSMUTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
