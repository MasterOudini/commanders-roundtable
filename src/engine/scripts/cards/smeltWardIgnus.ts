// `Smelt-Ward Ignus` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SMELT_WARD_IGNUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SMELT_WARD_IGNUS, "{2}{R}, Sacrifice this creature: Gain control of target creature with power 3 or less until end of turn. Untap that creature. It gains haste until end of turn. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Gain control of target creature with power 3 or less until end of turn. Untap that creature. It gains haste until end of turn.", SMELT_WARD_IGNUS.name);
const VOCAB_T_A0 = vocabularyTargets("Gain control of target creature with power 3 or less until end of turn. Untap that creature. It gains haste until end of turn.");

export const SMELT_WARD_IGNUS_SCRIPT: CardScript = {
  oracleId: SMELT_WARD_IGNUS.oracleId,
  name: SMELT_WARD_IGNUS.name,
  activated: [
    {
      ref: `${SMELT_WARD_IGNUS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
