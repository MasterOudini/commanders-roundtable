// `Erratic Portal` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ERRATIC_PORTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ERRATIC_PORTAL, "{1}, {T}: Return target creature to its owner's hand unless its controller pays {1}.");

const VOCAB_A0 = vocabularyEffects("Return target creature to its owner's hand unless its controller pays {1}.", ERRATIC_PORTAL.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature to its owner's hand unless its controller pays {1}.");

export const ERRATIC_PORTAL_SCRIPT: CardScript = {
  oracleId: ERRATIC_PORTAL.oracleId,
  name: ERRATIC_PORTAL.name,
  activated: [
    {
      ref: `${ERRATIC_PORTAL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
