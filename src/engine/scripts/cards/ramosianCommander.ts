// `Ramosian Commander` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAMOSIAN_COMMANDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAMOSIAN_COMMANDER, "{6}, {T}: Search your library for a Rebel permanent card with mana value 5 or less, put it onto the battlefield, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for a Rebel permanent card with mana value 5 or less, put it onto the battlefield, then shuffle.", RAMOSIAN_COMMANDER.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Rebel permanent card with mana value 5 or less, put it onto the battlefield, then shuffle.");

export const RAMOSIAN_COMMANDER_SCRIPT: CardScript = {
  oracleId: RAMOSIAN_COMMANDER.oracleId,
  name: RAMOSIAN_COMMANDER.name,
  activated: [
    {
      ref: `${RAMOSIAN_COMMANDER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
