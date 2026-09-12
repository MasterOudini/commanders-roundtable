// `Galecaster Colossus` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GALECASTER_COLOSSUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GALECASTER_COLOSSUS, "Tap an untapped Wizard you control: Return target nonland permanent you don't control to its owner's hand.");

const VOCAB_A0 = vocabularyEffects("Return target nonland permanent you don't control to its owner's hand.", GALECASTER_COLOSSUS.name);
const VOCAB_T_A0 = vocabularyTargets("Return target nonland permanent you don't control to its owner's hand.");

export const GALECASTER_COLOSSUS_SCRIPT: CardScript = {
  oracleId: GALECASTER_COLOSSUS.oracleId,
  name: GALECASTER_COLOSSUS.name,
  activated: [
    {
      ref: `${GALECASTER_COLOSSUS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
