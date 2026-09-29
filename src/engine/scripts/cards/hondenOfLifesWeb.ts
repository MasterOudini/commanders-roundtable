// `Honden of Life's Web` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HONDEN_OF_LIFE_S_WEB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HONDEN_OF_LIFE_S_WEB, "At the beginning of your upkeep, create a 1/1 colorless Spirit creature token for each Shrine you control.");

const VOCAB_L0 = vocabularyEffects("Create a 1/1 colorless Spirit creature token for each Shrine you control.", HONDEN_OF_LIFE_S_WEB.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 1/1 colorless Spirit creature token for each Shrine you control.");

export const HONDEN_OF_LIFES_WEB_SCRIPT: CardScript = {
  oracleId: HONDEN_OF_LIFE_S_WEB.oracleId,
  name: HONDEN_OF_LIFE_S_WEB.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Honden of Life's Web - Create a 1/1 colorless Spirit creature token for each Shrine you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
