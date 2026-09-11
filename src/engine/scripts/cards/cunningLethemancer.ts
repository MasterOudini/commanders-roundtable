// `Cunning Lethemancer` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CUNNING_LETHEMANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CUNNING_LETHEMANCER, "At the beginning of your upkeep, each player discards a card.");

const VOCAB_L0 = vocabularyEffects("Each player discards a card.", CUNNING_LETHEMANCER.name);
const VOCAB_T_L0 = vocabularyTargets("Each player discards a card.");

export const CUNNING_LETHEMANCER_SCRIPT: CardScript = {
  oracleId: CUNNING_LETHEMANCER.oracleId,
  name: CUNNING_LETHEMANCER.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Cunning Lethemancer - Each player discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
