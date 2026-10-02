// `Clearwater Goblet` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLEARWATER_GOBLET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLEARWATER_GOBLET, "Sunburst (This artifact enters with a charge counter on it for each color of mana spent to cast it.)\nAt the beginning of your upkeep, you may gain life equal to the number of charge counters on this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Gain life equal to the number of charge counters on this artifact.", CLEARWATER_GOBLET.name);
const VOCAB_T_L1 = vocabularyTargets("Gain life equal to the number of charge counters on this artifact.");

export const CLEARWATER_GOBLET_SCRIPT: CardScript = {
  oracleId: CLEARWATER_GOBLET.oracleId,
  name: CLEARWATER_GOBLET.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Clearwater Goblet - Gain life equal to the number of charge counters on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
