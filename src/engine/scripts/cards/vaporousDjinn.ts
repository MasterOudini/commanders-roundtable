// `Vaporous Djinn` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VAPOROUS_DJINN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VAPOROUS_DJINN, "Flying\nAt the beginning of your upkeep, this creature phases out unless you pay {U}{U}. (While it's phased out, it's treated as though it doesn't exist. It phases in before you untap during your next untap step.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ phases out unless you pay {U}{U}.", VAPOROUS_DJINN.name);
const VOCAB_T_L1 = vocabularyTargets("~ phases out unless you pay {U}{U}.");

export const VAPOROUS_DJINN_SCRIPT: CardScript = {
  oracleId: VAPOROUS_DJINN.oracleId,
  name: VAPOROUS_DJINN.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Vaporous Djinn - ~ phases out unless you pay {U}{U}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
