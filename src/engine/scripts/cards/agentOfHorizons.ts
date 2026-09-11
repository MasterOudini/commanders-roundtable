// `Agent of Horizons` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AGENT_OF_HORIZONS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AGENT_OF_HORIZONS, "{2}{U}: This creature can't be blocked this turn.");

const VOCAB_A0 = vocabularyEffects("~ can't be blocked this turn.", AGENT_OF_HORIZONS.name);
const VOCAB_T_A0 = vocabularyTargets("~ can't be blocked this turn.");

export const AGENT_OF_HORIZONS_SCRIPT: CardScript = {
  oracleId: AGENT_OF_HORIZONS.oracleId,
  name: AGENT_OF_HORIZONS.name,
  activated: [
    {
      ref: `${AGENT_OF_HORIZONS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
