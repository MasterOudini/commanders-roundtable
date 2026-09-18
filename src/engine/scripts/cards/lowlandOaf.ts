// `Lowland Oaf` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOWLAND_OAF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOWLAND_OAF, "{T}: Target Goblin creature you control gets +1/+0 and gains flying until end of turn. Sacrifice that creature at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("Target Goblin creature you control gets +1/+0 and gains flying until end of turn. Sacrifice that creature at the beginning of the next end step.", LOWLAND_OAF.name);
const VOCAB_T_A0 = vocabularyTargets("Target Goblin creature you control gets +1/+0 and gains flying until end of turn. Sacrifice that creature at the beginning of the next end step.");

export const LOWLAND_OAF_SCRIPT: CardScript = {
  oracleId: LOWLAND_OAF.oracleId,
  name: LOWLAND_OAF.name,
  activated: [
    {
      ref: `${LOWLAND_OAF.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
