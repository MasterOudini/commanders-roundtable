// `Patriot, Shield Wielder` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PATRIOT_SHIELD_WIELDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PATRIOT_SHIELD_WIELDER, "{2}, {T}: Another target creature you control gets +2/+0 and gains hexproof until end of turn. (It can't be the target of spells or abilities your opponents control.)");

const VOCAB_A0 = vocabularyEffects("Another target creature you control gets +2/+0 and gains hexproof until end of turn.", PATRIOT_SHIELD_WIELDER.name);
const VOCAB_T_A0 = vocabularyTargets("Another target creature you control gets +2/+0 and gains hexproof until end of turn.");

export const PATRIOT_SHIELD_WIELDER_SCRIPT: CardScript = {
  oracleId: PATRIOT_SHIELD_WIELDER.oracleId,
  name: PATRIOT_SHIELD_WIELDER.name,
  activated: [
    {
      ref: `${PATRIOT_SHIELD_WIELDER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
