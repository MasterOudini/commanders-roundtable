// `Cackling Witch` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CACKLING_WITCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CACKLING_WITCH, "{X}{B}, {T}, Discard a card: Target creature gets +X/+0 until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target creature gets +X/+0 until end of turn.", CACKLING_WITCH.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("Target creature gets +X/+0 until end of turn.");

export const CACKLING_WITCH_SCRIPT: CardScript = {
  oracleId: CACKLING_WITCH.oracleId,
  name: CACKLING_WITCH.name,
  activated: [
    {
      ref: `${CACKLING_WITCH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
