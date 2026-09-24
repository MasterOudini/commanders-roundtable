// `Phyrexian Infiltrator` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHYREXIAN_INFILTRATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHYREXIAN_INFILTRATOR, "{2}{U}{U}: Exchange control of this creature and target creature. (This effect lasts indefinitely.)");

const VOCAB_A0 = vocabularyEffects("Exchange control of this creature and target creature.", PHYREXIAN_INFILTRATOR.name);
const VOCAB_T_A0 = vocabularyTargets("Exchange control of this creature and target creature.");

export const PHYREXIAN_INFILTRATOR_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_INFILTRATOR.oracleId,
  name: PHYREXIAN_INFILTRATOR.name,
  activated: [
    {
      ref: `${PHYREXIAN_INFILTRATOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
