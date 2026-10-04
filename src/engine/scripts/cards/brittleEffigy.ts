// `Brittle Effigy` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRITTLE_EFFIGY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRITTLE_EFFIGY, "{4}, {T}, Exile this artifact: Exile target creature.");

const VOCAB_A0 = vocabularyEffects("Exile target creature.", BRITTLE_EFFIGY.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target creature.");

export const BRITTLE_EFFIGY_SCRIPT: CardScript = {
  oracleId: BRITTLE_EFFIGY.oracleId,
  name: BRITTLE_EFFIGY.name,
  activated: [
    {
      ref: `${BRITTLE_EFFIGY.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
