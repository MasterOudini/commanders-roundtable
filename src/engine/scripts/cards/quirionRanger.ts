// `Quirion Ranger` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUIRION_RANGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUIRION_RANGER, "Return a Forest you control to its owner's hand: Untap target creature. Activate only once each turn.");

const VOCAB_A0 = vocabularyEffects("Untap target creature.", QUIRION_RANGER.name);
const VOCAB_T_A0 = vocabularyTargets("Untap target creature.");

export const QUIRION_RANGER_SCRIPT: CardScript = {
  oracleId: QUIRION_RANGER.oracleId,
  name: QUIRION_RANGER.name,
  activated: [
    {
      ref: `${QUIRION_RANGER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
