// `Mycoloth` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MYCOLOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MYCOLOTH, "Devour 2 (As this creature enters, you may sacrifice any number of creatures. It enters with twice that many +1/+1 counters on it.)\nAt the beginning of your upkeep, create a 1/1 green Saproling creature token for each +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a 1/1 green Saproling creature token for each +1/+1 counter on ~.", MYCOLOTH.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 1/1 green Saproling creature token for each +1/+1 counter on ~.");

export const MYCOLOTH_SCRIPT: CardScript = {
  oracleId: MYCOLOTH.oracleId,
  name: MYCOLOTH.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Mycoloth - Create a 1/1 green Saproling creature token for each +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
