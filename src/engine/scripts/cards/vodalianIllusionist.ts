// `Vodalian Illusionist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VODALIAN_ILLUSIONIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VODALIAN_ILLUSIONIST, "{U}{U}, {T}: Target creature phases out. (While it's phased out, it's treated as though it doesn't exist. It phases in before its controller untaps during their next untap step.)");

const VOCAB_A0 = vocabularyEffects("Target creature phases out.", VODALIAN_ILLUSIONIST.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature phases out.");

export const VODALIAN_ILLUSIONIST_SCRIPT: CardScript = {
  oracleId: VODALIAN_ILLUSIONIST.oracleId,
  name: VODALIAN_ILLUSIONIST.name,
  activated: [
    {
      ref: `${VODALIAN_ILLUSIONIST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
