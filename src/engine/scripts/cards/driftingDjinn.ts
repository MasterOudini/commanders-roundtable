// `Drifting Djinn` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRIFTING_DJINN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRIFTING_DJINN, "Flying\nAt the beginning of your upkeep, sacrifice this creature unless you pay {1}{U}.\nCycling {2} ({2}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Sacrifice this creature unless you pay {1}{U}.", DRIFTING_DJINN.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice this creature unless you pay {1}{U}.");

export const DRIFTING_DJINN_SCRIPT: CardScript = {
  oracleId: DRIFTING_DJINN.oracleId,
  name: DRIFTING_DJINN.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Drifting Djinn - Sacrifice this creature unless you pay {1}{U}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
