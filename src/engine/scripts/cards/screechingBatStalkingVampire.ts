// `Screeching Bat // Stalking Vampire` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCREECHING_BAT_STALKING_VAMPIRE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(SCREECHING_BAT_STALKING_VAMPIRE, "Flying\nAt the beginning of your upkeep, you may pay {2}{B}{B}. If you do, transform this creature.\nAt the beginning of your upkeep, you may pay {2}{B}{B}. If you do, transform this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {2}{B}{B}. If you do, transform this creature.", SCREECHING_BAT_STALKING_VAMPIRE.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {2}{B}{B}. If you do, transform this creature.");

export const SCREECHING_BAT_STALKING_VAMPIRE_SCRIPT: CardScript = {
  oracleId: SCREECHING_BAT_STALKING_VAMPIRE.oracleId,
  name: SCREECHING_BAT_STALKING_VAMPIRE.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Screeching Bat // Stalking Vampire - You may pay {2}{B}{B}. If you do, transform this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
