// `Cartel Aristocrat` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CARTEL_ARISTOCRAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CARTEL_ARISTOCRAT, "Sacrifice another creature: This creature gains protection from the color of your choice until end of turn.");

const VOCAB_A0 = vocabularyEffects("~ gains protection from the color of your choice until end of turn.", CARTEL_ARISTOCRAT.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains protection from the color of your choice until end of turn.");

export const CARTEL_ARISTOCRAT_SCRIPT: CardScript = {
  oracleId: CARTEL_ARISTOCRAT.oracleId,
  name: CARTEL_ARISTOCRAT.name,
  activated: [
    {
      ref: `${CARTEL_ARISTOCRAT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
