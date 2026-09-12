// `Corpse Hauler` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORPSE_HAULER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORPSE_HAULER, "{2}{B}, Sacrifice this creature: Return another target creature card from your graveyard to your hand.");

const VOCAB_A0 = vocabularyEffects("Return another target creature card from your graveyard to your hand.", CORPSE_HAULER.name);
const VOCAB_T_A0 = vocabularyTargets("Return another target creature card from your graveyard to your hand.");

export const CORPSE_HAULER_SCRIPT: CardScript = {
  oracleId: CORPSE_HAULER.oracleId,
  name: CORPSE_HAULER.name,
  activated: [
    {
      ref: `${CORPSE_HAULER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
