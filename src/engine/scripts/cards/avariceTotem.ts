// `Avarice Totem` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVARICE_TOTEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVARICE_TOTEM, "{5}: Exchange control of this artifact and target nonland permanent.");

const VOCAB_A0 = vocabularyEffects("Exchange control of this artifact and target nonland permanent.", AVARICE_TOTEM.name);
const VOCAB_T_A0 = vocabularyTargets("Exchange control of this artifact and target nonland permanent.");

export const AVARICE_TOTEM_SCRIPT: CardScript = {
  oracleId: AVARICE_TOTEM.oracleId,
  name: AVARICE_TOTEM.name,
  activated: [
    {
      ref: `${AVARICE_TOTEM.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
