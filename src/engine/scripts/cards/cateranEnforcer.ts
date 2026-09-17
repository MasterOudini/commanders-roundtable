// `Cateran Enforcer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CATERAN_ENFORCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CATERAN_ENFORCER, "Fear (This creature can't be blocked except by artifact creatures and/or black creatures.)\n{4}, {T}: Search your library for a Mercenary permanent card with mana value 4 or less, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a Mercenary permanent card with mana value 4 or less, put it onto the battlefield, then shuffle.", CATERAN_ENFORCER.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Mercenary permanent card with mana value 4 or less, put it onto the battlefield, then shuffle.");

export const CATERAN_ENFORCER_SCRIPT: CardScript = {
  oracleId: CATERAN_ENFORCER.oracleId,
  name: CATERAN_ENFORCER.name,
  activated: [
    {
      ref: `${CATERAN_ENFORCER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
