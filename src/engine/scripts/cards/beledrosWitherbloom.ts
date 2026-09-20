// `Beledros Witherbloom` - a eachUpkeep trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BELEDROS_WITHERBLOOM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BELEDROS_WITHERBLOOM, "Flying\nAt the beginning of each upkeep, create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"\nPay 10 life: Untap all lands you control. Activate only once each turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"", BELEDROS_WITHERBLOOM.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"");
const VOCAB_A0 = vocabularyEffects("Untap all lands you control.", BELEDROS_WITHERBLOOM.name);
const VOCAB_T_A0 = vocabularyTargets("Untap all lands you control.");

export const BELEDROS_WITHERBLOOM_SCRIPT: CardScript = {
  oracleId: BELEDROS_WITHERBLOOM.oracleId,
  name: BELEDROS_WITHERBLOOM.name,
  activated: [
    {
      ref: `${BELEDROS_WITHERBLOOM.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'eachUpkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Beledros Witherbloom - Create a 1/1 black and green Pest creature token with \"When this token dies, you gain 1 life.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
