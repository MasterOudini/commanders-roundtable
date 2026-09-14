// `Species Gorger` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPECIES_GORGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPECIES_GORGER, "At the beginning of your upkeep, return a creature you control to its owner's hand.");

const VOCAB_L0 = vocabularyEffects("Return a creature you control to its owner's hand.", SPECIES_GORGER.name);
const VOCAB_T_L0 = vocabularyTargets("Return a creature you control to its owner's hand.");

export const SPECIES_GORGER_SCRIPT: CardScript = {
  oracleId: SPECIES_GORGER.oracleId,
  name: SPECIES_GORGER.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Species Gorger - Return a creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
