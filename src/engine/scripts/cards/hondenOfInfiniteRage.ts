// `Honden of Infinite Rage` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HONDEN_OF_INFINITE_RAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HONDEN_OF_INFINITE_RAGE, "At the beginning of your upkeep, Honden of Infinite Rage deals damage to any target equal to the number of Shrines you control.");

const VOCAB_L0 = vocabularyEffects("~ deals damage to any target equal to the number of Shrines you control.", HONDEN_OF_INFINITE_RAGE.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals damage to any target equal to the number of Shrines you control.");

export const HONDEN_OF_INFINITE_RAGE_SCRIPT: CardScript = {
  oracleId: HONDEN_OF_INFINITE_RAGE.oracleId,
  name: HONDEN_OF_INFINITE_RAGE.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Honden of Infinite Rage - ~ deals damage to any target equal to the number of Shrines you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
