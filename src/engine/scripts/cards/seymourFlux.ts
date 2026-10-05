// `Seymour Flux` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEYMOUR_FLUX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEYMOUR_FLUX, "At the beginning of your upkeep, you may pay 1 life. If you do, draw a card and put a +1/+1 counter on Seymour Flux.");

const VOCAB_L0 = vocabularyEffects("You may pay 1 life. If you do, draw a card and put a +1/+1 counter on ~.", SEYMOUR_FLUX.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay 1 life. If you do, draw a card and put a +1/+1 counter on ~.");

export const SEYMOUR_FLUX_SCRIPT: CardScript = {
  oracleId: SEYMOUR_FLUX.oracleId,
  name: SEYMOUR_FLUX.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Seymour Flux - You may pay 1 life. If you do, draw a card and put a +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
