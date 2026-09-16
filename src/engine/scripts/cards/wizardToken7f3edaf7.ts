// `Wizard` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WIZARD_7F3EDAF7_TOKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WIZARD_7F3EDAF7_TOKEN, "{1}, Sacrifice this creature: Counter target noncreature spell unless its controller pays {1}.");

const VOCAB_A0 = vocabularyEffects("Counter target noncreature spell unless its controller pays {1}.", WIZARD_7F3EDAF7_TOKEN.name);
const VOCAB_T_A0 = vocabularyTargets("Counter target noncreature spell unless its controller pays {1}.");

export const WIZARD_TOKEN7F3EDAF7_SCRIPT: CardScript = {
  oracleId: WIZARD_7F3EDAF7_TOKEN.oracleId,
  name: WIZARD_7F3EDAF7_TOKEN.name,
  activated: [
    {
      ref: `${WIZARD_7F3EDAF7_TOKEN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
