// `Forerunner of Slaughter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORERUNNER_OF_SLAUGHTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORERUNNER_OF_SLAUGHTER, "Devoid (This card has no color.)\n{1}: Target colorless creature gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target colorless creature gains haste until end of turn.", FORERUNNER_OF_SLAUGHTER.name);
const VOCAB_T_A0 = vocabularyTargets("Target colorless creature gains haste until end of turn.");

export const FORERUNNER_OF_SLAUGHTER_SCRIPT: CardScript = {
  oracleId: FORERUNNER_OF_SLAUGHTER.oracleId,
  name: FORERUNNER_OF_SLAUGHTER.name,
  activated: [
    {
      ref: `${FORERUNNER_OF_SLAUGHTER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
