// `Diversion Specialist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIVERSION_SPECIALIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIVERSION_SPECIALIST, "Menace (This creature can't be blocked except by two or more creatures.)\n{1}, Sacrifice another creature or enchantment: Exile the top card of your library. You may play it this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile the top card of your library. You may play it this turn.", DIVERSION_SPECIALIST.name);
const VOCAB_T_A0 = vocabularyTargets("Exile the top card of your library. You may play it this turn.");

export const DIVERSION_SPECIALIST_SCRIPT: CardScript = {
  oracleId: DIVERSION_SPECIALIST.oracleId,
  name: DIVERSION_SPECIALIST.name,
  activated: [
    {
      ref: `${DIVERSION_SPECIALIST.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
