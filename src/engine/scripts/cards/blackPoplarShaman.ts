// `Black Poplar Shaman` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLACK_POPLAR_SHAMAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLACK_POPLAR_SHAMAN, "{2}{B}: Regenerate target Treefolk.");

const VOCAB_A0 = vocabularyEffects("Regenerate target Treefolk.", BLACK_POPLAR_SHAMAN.name);
const VOCAB_T_A0 = vocabularyTargets("Regenerate target Treefolk.");

export const BLACK_POPLAR_SHAMAN_SCRIPT: CardScript = {
  oracleId: BLACK_POPLAR_SHAMAN.oracleId,
  name: BLACK_POPLAR_SHAMAN.name,
  activated: [
    {
      ref: `${BLACK_POPLAR_SHAMAN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
