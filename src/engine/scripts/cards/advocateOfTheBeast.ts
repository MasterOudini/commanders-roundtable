// `Advocate of the Beast` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ADVOCATE_OF_THE_BEAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ADVOCATE_OF_THE_BEAST, "At the beginning of your end step, put a +1/+1 counter on target Beast creature you control.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target Beast creature you control.", ADVOCATE_OF_THE_BEAST.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target Beast creature you control.");

export const ADVOCATE_OF_THE_BEAST_SCRIPT: CardScript = {
  oracleId: ADVOCATE_OF_THE_BEAST.oracleId,
  name: ADVOCATE_OF_THE_BEAST.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Advocate of the Beast - Put a +1/+1 counter on target Beast creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
