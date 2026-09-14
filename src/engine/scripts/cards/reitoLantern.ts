// `Reito Lantern` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { REITO_LANTERN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(REITO_LANTERN, "{3}: Put target card from a graveyard on the bottom of its owner's library.");

const VOCAB_A0 = vocabularyEffects("Put target card from a graveyard on the bottom of its owner's library.", REITO_LANTERN.name);
const VOCAB_T_A0 = vocabularyTargets("Put target card from a graveyard on the bottom of its owner's library.");

export const REITO_LANTERN_SCRIPT: CardScript = {
  oracleId: REITO_LANTERN.oracleId,
  name: REITO_LANTERN.name,
  activated: [
    {
      ref: `${REITO_LANTERN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
