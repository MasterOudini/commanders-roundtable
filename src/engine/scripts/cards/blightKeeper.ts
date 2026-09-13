// `Blight Keeper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIGHT_KEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLIGHT_KEEPER, "Flying\n{7}{B}, {T}, Sacrifice this creature: Target opponent loses 4 life and you gain 4 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target opponent loses 4 life and you gain 4 life.", BLIGHT_KEEPER.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent loses 4 life and you gain 4 life.");

export const BLIGHT_KEEPER_SCRIPT: CardScript = {
  oracleId: BLIGHT_KEEPER.oracleId,
  name: BLIGHT_KEEPER.name,
  activated: [
    {
      ref: `${BLIGHT_KEEPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
