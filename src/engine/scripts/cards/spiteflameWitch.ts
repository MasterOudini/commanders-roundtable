// `Spiteflame Witch` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPITEFLAME_WITCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPITEFLAME_WITCH, "{B}{R}: Each player loses 1 life.");

const VOCAB_A0 = vocabularyEffects("Each player loses 1 life.", SPITEFLAME_WITCH.name);
const VOCAB_T_A0 = vocabularyTargets("Each player loses 1 life.");

export const SPITEFLAME_WITCH_SCRIPT: CardScript = {
  oracleId: SPITEFLAME_WITCH.oracleId,
  name: SPITEFLAME_WITCH.name,
  activated: [
    {
      ref: `${SPITEFLAME_WITCH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
