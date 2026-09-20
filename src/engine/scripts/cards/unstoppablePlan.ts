// `Unstoppable Plan` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNSTOPPABLE_PLAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNSTOPPABLE_PLAN, "At the beginning of your end step, untap all nonland permanents you control.");

const VOCAB_L0 = vocabularyEffects("Untap all nonland permanents you control.", UNSTOPPABLE_PLAN.name);
const VOCAB_T_L0 = vocabularyTargets("Untap all nonland permanents you control.");

export const UNSTOPPABLE_PLAN_SCRIPT: CardScript = {
  oracleId: UNSTOPPABLE_PLAN.oracleId,
  name: UNSTOPPABLE_PLAN.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Unstoppable Plan - Untap all nonland permanents you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
