// `Honden of Seeing Winds` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HONDEN_OF_SEEING_WINDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HONDEN_OF_SEEING_WINDS, "At the beginning of your upkeep, draw a card for each Shrine you control.");

const VOCAB_L0 = vocabularyEffects("Draw a card for each Shrine you control.", HONDEN_OF_SEEING_WINDS.name);
const VOCAB_T_L0 = vocabularyTargets("Draw a card for each Shrine you control.");

export const HONDEN_OF_SEEING_WINDS_SCRIPT: CardScript = {
  oracleId: HONDEN_OF_SEEING_WINDS.oracleId,
  name: HONDEN_OF_SEEING_WINDS.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Honden of Seeing Winds - Draw a card for each Shrine you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
