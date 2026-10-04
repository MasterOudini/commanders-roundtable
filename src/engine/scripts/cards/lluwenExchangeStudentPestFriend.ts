// `Lluwen, Exchange Student // Pest Friend` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LLUWEN_EXCHANGE_STUDENT_PEST_FRIEND } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(LLUWEN_EXCHANGE_STUDENT_PEST_FRIEND, "Lluwen enters prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\nExile a creature card from your graveyard: Lluwen becomes prepared. Activate only as a sorcery.\nCreate a 1/1 black and green Pest creature token with \"Whenever this token attacks, you gain 1 life.\"");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ becomes prepared.", LLUWEN_EXCHANGE_STUDENT_PEST_FRIEND.name);
const VOCAB_T_A0 = vocabularyTargets("~ becomes prepared.");

export const LLUWEN_EXCHANGE_STUDENT_PEST_FRIEND_SCRIPT: CardScript = {
  oracleId: LLUWEN_EXCHANGE_STUDENT_PEST_FRIEND.oracleId,
  name: LLUWEN_EXCHANGE_STUDENT_PEST_FRIEND.name,
  activated: [
    {
      ref: `${LLUWEN_EXCHANGE_STUDENT_PEST_FRIEND.oracleId}#a0`, face: 0,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
