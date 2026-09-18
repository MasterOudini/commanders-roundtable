// `Mistmeadow Witch` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MISTMEADOW_WITCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MISTMEADOW_WITCH, "{2}{W}{U}: Exile target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("Exile target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.", MISTMEADOW_WITCH.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

export const MISTMEADOW_WITCH_SCRIPT: CardScript = {
  oracleId: MISTMEADOW_WITCH.oracleId,
  name: MISTMEADOW_WITCH.name,
  activated: [
    {
      ref: `${MISTMEADOW_WITCH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
