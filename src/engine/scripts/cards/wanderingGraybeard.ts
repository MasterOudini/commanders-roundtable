// `Wandering Graybeard` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WANDERING_GRAYBEARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WANDERING_GRAYBEARD, "Kinship — At the beginning of your upkeep, you may look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, you gain 4 life.");

const VOCAB_L0 = vocabularyEffects("Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, you gain 4 life.", WANDERING_GRAYBEARD.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, you gain 4 life.");

export const WANDERING_GRAYBEARD_SCRIPT: CardScript = {
  oracleId: WANDERING_GRAYBEARD.oracleId,
  name: WANDERING_GRAYBEARD.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Wandering Graybeard - Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, you gain 4 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
