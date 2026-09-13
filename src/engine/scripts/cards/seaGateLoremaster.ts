// `Sea Gate Loremaster` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEA_GATE_LOREMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEA_GATE_LOREMASTER, "{T}: Draw a card for each Ally you control.");

const VOCAB_A0 = vocabularyEffects("Draw a card for each Ally you control.", SEA_GATE_LOREMASTER.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card for each Ally you control.");

export const SEA_GATE_LOREMASTER_SCRIPT: CardScript = {
  oracleId: SEA_GATE_LOREMASTER.oracleId,
  name: SEA_GATE_LOREMASTER.name,
  activated: [
    {
      ref: `${SEA_GATE_LOREMASTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
