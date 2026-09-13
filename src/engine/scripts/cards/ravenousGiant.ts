// `Ravenous Giant` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAVENOUS_GIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAVENOUS_GIANT, "At the beginning of your upkeep, this creature deals 1 damage to you.");

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to you.", RAVENOUS_GIANT.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to you.");

export const RAVENOUS_GIANT_SCRIPT: CardScript = {
  oracleId: RAVENOUS_GIANT.oracleId,
  name: RAVENOUS_GIANT.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Ravenous Giant - ~ deals 1 damage to you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
