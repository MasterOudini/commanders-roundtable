// `Wilderness Reclamation` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WILDERNESS_RECLAMATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WILDERNESS_RECLAMATION, "At the beginning of your end step, untap all lands you control.");

const VOCAB_L0 = vocabularyEffects("Untap all lands you control.", WILDERNESS_RECLAMATION.name);
const VOCAB_T_L0 = vocabularyTargets("Untap all lands you control.");

export const WILDERNESS_RECLAMATION_SCRIPT: CardScript = {
  oracleId: WILDERNESS_RECLAMATION.oracleId,
  name: WILDERNESS_RECLAMATION.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Wilderness Reclamation - Untap all lands you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
