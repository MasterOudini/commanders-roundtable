// `Bola Warrior` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOLA_WARRIOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOLA_WARRIOR, "{R}, {T}, Discard a card: Target creature can't block this turn.");

const VOCAB_A0 = vocabularyEffects("Target creature can't block this turn.", BOLA_WARRIOR.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this turn.");

export const BOLA_WARRIOR_SCRIPT: CardScript = {
  oracleId: BOLA_WARRIOR.oracleId,
  name: BOLA_WARRIOR.name,
  activated: [
    {
      ref: `${BOLA_WARRIOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
