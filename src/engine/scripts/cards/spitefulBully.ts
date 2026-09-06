// `Spiteful Bully` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPITEFUL_BULLY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPITEFUL_BULLY, "At the beginning of your upkeep, this creature deals 3 damage to target creature you control.");

const VOCAB_L0 = vocabularyEffects("~ deals 3 damage to target creature you control.", SPITEFUL_BULLY.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 3 damage to target creature you control.");

export const SPITEFUL_BULLY_SCRIPT: CardScript = {
  oracleId: SPITEFUL_BULLY.oracleId,
  name: SPITEFUL_BULLY.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Spiteful Bully - ~ deals 3 damage to target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
