// `Hell's Caretaker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HELL_S_CARETAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HELL_S_CARETAKER, "{T}, Sacrifice a creature: Return target creature card from your graveyard to the battlefield. Activate only during your upkeep.");

const VOCAB_A0 = vocabularyEffects("Return target creature card from your graveyard to the battlefield.", HELL_S_CARETAKER.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature card from your graveyard to the battlefield.");

export const HELLS_CARETAKER_SCRIPT: CardScript = {
  oracleId: HELL_S_CARETAKER.oracleId,
  name: HELL_S_CARETAKER.name,
  activated: [
    {
      ref: `${HELL_S_CARETAKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
