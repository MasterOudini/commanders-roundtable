// `Aphemia, the Cacophony` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APHEMIA_THE_CACOPHONY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APHEMIA_THE_CACOPHONY, "Flying\nAt the beginning of your end step, you may exile an enchantment card from your graveyard. If you do, create a 2/2 black Zombie creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may exile an enchantment card from your graveyard. If you do, create a 2/2 black Zombie creature token.", APHEMIA_THE_CACOPHONY.name);
const VOCAB_T_L1 = vocabularyTargets("You may exile an enchantment card from your graveyard. If you do, create a 2/2 black Zombie creature token.");

export const APHEMIA_THE_CACOPHONY_SCRIPT: CardScript = {
  oracleId: APHEMIA_THE_CACOPHONY.oracleId,
  name: APHEMIA_THE_CACOPHONY.name,
  triggers: [
    {
      abilityId: 'endStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Aphemia, the Cacophony - You may exile an enchantment card from your graveyard. If you do, create a 2/2 black Zombie creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
