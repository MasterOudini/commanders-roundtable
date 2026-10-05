// `Benevolent Bodyguard` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BENEVOLENT_BODYGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BENEVOLENT_BODYGUARD, "Sacrifice this creature: Target creature you control gains protection from the color of your choice until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target creature you control gains protection from the color of your choice until end of turn.", BENEVOLENT_BODYGUARD.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gains protection from the color of your choice until end of turn.");

export const BENEVOLENT_BODYGUARD_SCRIPT: CardScript = {
  oracleId: BENEVOLENT_BODYGUARD.oracleId,
  name: BENEVOLENT_BODYGUARD.name,
  activated: [
    {
      ref: `${BENEVOLENT_BODYGUARD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
