// `Gate to Phyrexia` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GATE_TO_PHYREXIA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GATE_TO_PHYREXIA, "Sacrifice a creature: Destroy target artifact. Activate only during your upkeep and only once each turn.");

const VOCAB_A0 = vocabularyEffects("Destroy target artifact.", GATE_TO_PHYREXIA.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact.");

export const GATE_TO_PHYREXIA_SCRIPT: CardScript = {
  oracleId: GATE_TO_PHYREXIA.oracleId,
  name: GATE_TO_PHYREXIA.name,
  activated: [
    {
      ref: `${GATE_TO_PHYREXIA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
