// `Bitterbloom Bearer` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BITTERBLOOM_BEARER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BITTERBLOOM_BEARER, "Flash\nFlying\nAt the beginning of your upkeep, you lose 1 life and create a 1/1 blue and black Faerie creature token with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You lose 1 life and create a 1/1 blue and black Faerie creature token with flying.", BITTERBLOOM_BEARER.name);
const VOCAB_T_L2 = vocabularyTargets("You lose 1 life and create a 1/1 blue and black Faerie creature token with flying.");

export const BITTERBLOOM_BEARER_SCRIPT: CardScript = {
  oracleId: BITTERBLOOM_BEARER.oracleId,
  name: BITTERBLOOM_BEARER.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Bitterbloom Bearer - You lose 1 life and create a 1/1 blue and black Faerie creature token with flying.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
