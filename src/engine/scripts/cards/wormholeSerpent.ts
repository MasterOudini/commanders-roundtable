// `Wormhole Serpent` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WORMHOLE_SERPENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WORMHOLE_SERPENT, "{3}{U}: Target creature can't be blocked this turn.");

const VOCAB_A0 = vocabularyEffects("Target creature can't be blocked this turn.", WORMHOLE_SERPENT.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't be blocked this turn.");

export const WORMHOLE_SERPENT_SCRIPT: CardScript = {
  oracleId: WORMHOLE_SERPENT.oracleId,
  name: WORMHOLE_SERPENT.name,
  activated: [
    {
      ref: `${WORMHOLE_SERPENT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
