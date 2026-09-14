// `Apostle of Purifying Light` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APOSTLE_OF_PURIFYING_LIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APOSTLE_OF_PURIFYING_LIGHT, "Protection from black (This creature can't be blocked, targeted, dealt damage, enchanted, or equipped by anything black.)\n{2}: Exile target card from a graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile target card from a graveyard.", APOSTLE_OF_PURIFYING_LIGHT.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target card from a graveyard.");

export const APOSTLE_OF_PURIFYING_LIGHT_SCRIPT: CardScript = {
  oracleId: APOSTLE_OF_PURIFYING_LIGHT.oracleId,
  name: APOSTLE_OF_PURIFYING_LIGHT.name,
  activated: [
    {
      ref: `${APOSTLE_OF_PURIFYING_LIGHT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
