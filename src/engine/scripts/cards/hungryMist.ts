// `Hungry Mist` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HUNGRY_MIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HUNGRY_MIST, "At the beginning of your upkeep, sacrifice this creature unless you pay {G}{G}.");

const VOCAB_L0 = vocabularyEffects("Sacrifice this creature unless you pay {G}{G}.", HUNGRY_MIST.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice this creature unless you pay {G}{G}.");

export const HUNGRY_MIST_SCRIPT: CardScript = {
  oracleId: HUNGRY_MIST.oracleId,
  name: HUNGRY_MIST.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Hungry Mist - Sacrifice this creature unless you pay {G}{G}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
