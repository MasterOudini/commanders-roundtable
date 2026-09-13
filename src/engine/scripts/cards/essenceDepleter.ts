// `Essence Depleter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ESSENCE_DEPLETER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ESSENCE_DEPLETER, "Devoid (This card has no color.)\n{1}{C}: Target opponent loses 1 life and you gain 1 life. ({C} represents colorless mana.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target opponent loses 1 life and you gain 1 life.", ESSENCE_DEPLETER.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent loses 1 life and you gain 1 life.");

export const ESSENCE_DEPLETER_SCRIPT: CardScript = {
  oracleId: ESSENCE_DEPLETER.oracleId,
  name: ESSENCE_DEPLETER.name,
  activated: [
    {
      ref: `${ESSENCE_DEPLETER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
