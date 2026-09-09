// `Vodalian Mage` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VODALIAN_MAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VODALIAN_MAGE, "{U}, {T}: Counter target spell unless its controller pays {1}.");

const VOCAB_A0 = vocabularyEffects("Counter target spell unless its controller pays {1}.", VODALIAN_MAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Counter target spell unless its controller pays {1}.");

export const VODALIAN_MAGE_SCRIPT: CardScript = {
  oracleId: VODALIAN_MAGE.oracleId,
  name: VODALIAN_MAGE.name,
  activated: [
    {
      ref: `${VODALIAN_MAGE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
