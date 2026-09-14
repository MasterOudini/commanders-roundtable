// `Vedalken Entrancer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VEDALKEN_ENTRANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VEDALKEN_ENTRANCER, "{U}, {T}: Target player mills two cards.");

const VOCAB_A0 = vocabularyEffects("Target player mills two cards.", VEDALKEN_ENTRANCER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills two cards.");

export const VEDALKEN_ENTRANCER_SCRIPT: CardScript = {
  oracleId: VEDALKEN_ENTRANCER.oracleId,
  name: VEDALKEN_ENTRANCER.name,
  activated: [
    {
      ref: `${VEDALKEN_ENTRANCER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
