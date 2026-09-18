// `Kiki-Jiki, Mirror Breaker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KIKI_JIKI_MIRROR_BREAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KIKI_JIKI_MIRROR_BREAKER, "Haste\n{T}: Create a token that's a copy of target nonlegendary creature you control, except it has haste. Sacrifice it at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Create a token that's a copy of target nonlegendary creature you control, except it has haste. Sacrifice it at the beginning of the next end step.", KIKI_JIKI_MIRROR_BREAKER.name);
const VOCAB_T_A0 = vocabularyTargets("Create a token that's a copy of target nonlegendary creature you control, except it has haste. Sacrifice it at the beginning of the next end step.");

export const KIKI_JIKI_MIRROR_BREAKER_SCRIPT: CardScript = {
  oracleId: KIKI_JIKI_MIRROR_BREAKER.oracleId,
  name: KIKI_JIKI_MIRROR_BREAKER.name,
  activated: [
    {
      ref: `${KIKI_JIKI_MIRROR_BREAKER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
