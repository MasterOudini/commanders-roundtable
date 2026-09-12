// `Drooling Groodion` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DROOLING_GROODION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DROOLING_GROODION, "{2}{B}{G}, Sacrifice a creature: Target creature gets +2/+2 until end of turn. Another target creature gets -2/-2 until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target creature gets +2/+2 until end of turn. Another target creature gets -2/-2 until end of turn.", DROOLING_GROODION.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature gets +2/+2 until end of turn. Another target creature gets -2/-2 until end of turn.");

export const DROOLING_GROODION_SCRIPT: CardScript = {
  oracleId: DROOLING_GROODION.oracleId,
  name: DROOLING_GROODION.name,
  activated: [
    {
      ref: `${DROOLING_GROODION.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
