// `Grave Robbers` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAVE_ROBBERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRAVE_ROBBERS, "{B}, {T}: Exile target artifact card from a graveyard. You gain 2 life.");

const VOCAB_A0 = vocabularyEffects("Exile target artifact card from a graveyard. You gain 2 life.", GRAVE_ROBBERS.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target artifact card from a graveyard. You gain 2 life.");

export const GRAVE_ROBBERS_SCRIPT: CardScript = {
  oracleId: GRAVE_ROBBERS.oracleId,
  name: GRAVE_ROBBERS.name,
  activated: [
    {
      ref: `${GRAVE_ROBBERS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
