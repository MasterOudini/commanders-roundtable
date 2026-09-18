// `Apprentice Necromancer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APPRENTICE_NECROMANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APPRENTICE_NECROMANCER, "{B}, {T}, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. That creature gains haste. At the beginning of the next end step, sacrifice it.");

const VOCAB_A0 = vocabularyEffects("Return target creature card from your graveyard to the battlefield. That creature gains haste. At the beginning of the next end step, sacrifice it.", APPRENTICE_NECROMANCER.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature card from your graveyard to the battlefield. That creature gains haste. At the beginning of the next end step, sacrifice it.");

export const APPRENTICE_NECROMANCER_SCRIPT: CardScript = {
  oracleId: APPRENTICE_NECROMANCER.oracleId,
  name: APPRENTICE_NECROMANCER.name,
  activated: [
    {
      ref: `${APPRENTICE_NECROMANCER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
