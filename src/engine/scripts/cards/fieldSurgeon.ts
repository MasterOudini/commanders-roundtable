// `Field Surgeon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIELD_SURGEON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIELD_SURGEON, "Tap an untapped creature you control: Prevent the next 1 damage that would be dealt to target creature this turn.");

const VOCAB_A0 = vocabularyEffects("Prevent the next 1 damage that would be dealt to target creature this turn.", FIELD_SURGEON.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 1 damage that would be dealt to target creature this turn.");

export const FIELD_SURGEON_SCRIPT: CardScript = {
  oracleId: FIELD_SURGEON.oracleId,
  name: FIELD_SURGEON.name,
  activated: [
    {
      ref: `${FIELD_SURGEON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
