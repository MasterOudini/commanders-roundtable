// `Bitterblossom` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BITTERBLOSSOM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BITTERBLOSSOM, "At the beginning of your upkeep, you lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.");

const VOCAB_L0 = vocabularyEffects("You lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.", BITTERBLOSSOM.name);
const VOCAB_T_L0 = vocabularyTargets("You lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.");

export const BITTERBLOSSOM_SCRIPT: CardScript = {
  oracleId: BITTERBLOSSOM.oracleId,
  name: BITTERBLOSSOM.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Bitterblossom - You lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
