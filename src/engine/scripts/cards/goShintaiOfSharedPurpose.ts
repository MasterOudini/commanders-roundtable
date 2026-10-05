// `Go-Shintai of Shared Purpose` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GO_SHINTAI_OF_SHARED_PURPOSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GO_SHINTAI_OF_SHARED_PURPOSE, "Vigilance\nAt the beginning of your end step, you may pay {1}. If you do, create a 1/1 colorless Spirit creature token for each Shrine you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {1}. If you do, create a 1/1 colorless Spirit creature token for each Shrine you control.", GO_SHINTAI_OF_SHARED_PURPOSE.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {1}. If you do, create a 1/1 colorless Spirit creature token for each Shrine you control.");

export const GO_SHINTAI_OF_SHARED_PURPOSE_SCRIPT: CardScript = {
  oracleId: GO_SHINTAI_OF_SHARED_PURPOSE.oracleId,
  name: GO_SHINTAI_OF_SHARED_PURPOSE.name,
  triggers: [
    {
      abilityId: 'endStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Go-Shintai of Shared Purpose - You may pay {1}. If you do, create a 1/1 colorless Spirit creature token for each Shrine you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
