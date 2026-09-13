// `Corpse Traders` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORPSE_TRADERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORPSE_TRADERS, "{2}{B}, Sacrifice a creature: Target opponent reveals their hand. You choose a card from it. That player discards that card. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Target opponent reveals their hand. You choose a card from it. That player discards that card.", CORPSE_TRADERS.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent reveals their hand. You choose a card from it. That player discards that card.");

export const CORPSE_TRADERS_SCRIPT: CardScript = {
  oracleId: CORPSE_TRADERS.oracleId,
  name: CORPSE_TRADERS.name,
  activated: [
    {
      ref: `${CORPSE_TRADERS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
