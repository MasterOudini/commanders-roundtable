// `Cankerbloom` - an activation vocab, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CANKERBLOOM } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(CANKERBLOOM, "{1}, Sacrifice this creature: Choose one —\n• Destroy target artifact.\n• Destroy target enchantment.\n• Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const MODES_A0 = [
  { text: "Destroy target artifact.", targets: vocabularyTargets("Destroy target artifact.") },
  { text: "Destroy target enchantment.", targets: vocabularyTargets("Destroy target enchantment.") },
  { text: "Proliferate.", targets: vocabularyTargets("Proliferate.") },
];

const VOCAB_A0_m0 = vocabularyEffects("Destroy target artifact.", CANKERBLOOM.name);
const VOCAB_T_A0_m0 = vocabularyTargets("Destroy target artifact.");
const VOCAB_A0_m1 = vocabularyEffects("Destroy target enchantment.", CANKERBLOOM.name);
const VOCAB_T_A0_m1 = vocabularyTargets("Destroy target enchantment.");
const VOCAB_A0_m2 = vocabularyEffects("Proliferate.", CANKERBLOOM.name);
const VOCAB_T_A0_m2 = vocabularyTargets("Proliferate.");

export const CANKERBLOOM_SCRIPT: CardScript = {
  oracleId: CANKERBLOOM.oracleId,
  name: CANKERBLOOM.name,
  activated: [
    {
      ref: `${CANKERBLOOM.oracleId}#a0`,
      text: LINES[0] as string,
      modes: MODES_A0,
      modeChoice: { min: 1, max: 1 },
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_A0_m0, VOCAB_T_A0_m0);
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_A0_m1, VOCAB_T_A0_m1);
        }
        if (chosen === 2) {
          return ctx.vocabulary(obj, VOCAB_A0_m2, VOCAB_T_A0_m2);
        }
        return [];
      },
    },
  ],
};
