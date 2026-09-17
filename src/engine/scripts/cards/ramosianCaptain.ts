// `Ramosian Captain` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAMOSIAN_CAPTAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAMOSIAN_CAPTAIN, "First strike\n{5}, {T}: Search your library for a Rebel permanent card with mana value 4 or less, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a Rebel permanent card with mana value 4 or less, put it onto the battlefield, then shuffle.", RAMOSIAN_CAPTAIN.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Rebel permanent card with mana value 4 or less, put it onto the battlefield, then shuffle.");

export const RAMOSIAN_CAPTAIN_SCRIPT: CardScript = {
  oracleId: RAMOSIAN_CAPTAIN.oracleId,
  name: RAMOSIAN_CAPTAIN.name,
  activated: [
    {
      ref: `${RAMOSIAN_CAPTAIN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
