// `Seedcradle Witch` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEEDCRADLE_WITCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEEDCRADLE_WITCH, "{2}{G}{W}: Target creature gets +3/+3 until end of turn. Untap that creature.");

const VOCAB_A0 = vocabularyEffects("Target creature gets +3/+3 until end of turn. Untap that creature.", SEEDCRADLE_WITCH.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature gets +3/+3 until end of turn. Untap that creature.");

export const SEEDCRADLE_WITCH_SCRIPT: CardScript = {
  oracleId: SEEDCRADLE_WITCH.oracleId,
  name: SEEDCRADLE_WITCH.name,
  activated: [
    {
      ref: `${SEEDCRADLE_WITCH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
