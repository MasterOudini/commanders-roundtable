// `Viridian Scout` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIRIDIAN_SCOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIRIDIAN_SCOUT, "{2}{G}, Sacrifice this creature: It deals 2 damage to target creature with flying.");

const VOCAB_A0 = vocabularyEffects("~ deals 2 damage to target creature with flying.", VIRIDIAN_SCOUT.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 2 damage to target creature with flying.");

export const VIRIDIAN_SCOUT_SCRIPT: CardScript = {
  oracleId: VIRIDIAN_SCOUT.oracleId,
  name: VIRIDIAN_SCOUT.name,
  activated: [
    {
      ref: `${VIRIDIAN_SCOUT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
