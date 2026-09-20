// `Troublesome Spirit` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TROUBLESOME_SPIRIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TROUBLESOME_SPIRIT, "Flying\nAt the beginning of your end step, tap all lands you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap all lands you control.", TROUBLESOME_SPIRIT.name);
const VOCAB_T_L1 = vocabularyTargets("Tap all lands you control.");

export const TROUBLESOME_SPIRIT_SCRIPT: CardScript = {
  oracleId: TROUBLESOME_SPIRIT.oracleId,
  name: TROUBLESOME_SPIRIT.name,
  triggers: [
    {
      abilityId: 'endStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Troublesome Spirit - Tap all lands you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
