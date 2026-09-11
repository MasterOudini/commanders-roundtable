// `Crafty Pathmage` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRAFTY_PATHMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRAFTY_PATHMAGE, "{T}: Target creature with power 2 or less can't be blocked this turn.");

const VOCAB_A0 = vocabularyEffects("Target creature with power 2 or less can't be blocked this turn.", CRAFTY_PATHMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature with power 2 or less can't be blocked this turn.");

export const CRAFTY_PATHMAGE_SCRIPT: CardScript = {
  oracleId: CRAFTY_PATHMAGE.oracleId,
  name: CRAFTY_PATHMAGE.name,
  activated: [
    {
      ref: `${CRAFTY_PATHMAGE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
