// `Stampeding Wildebeests` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STAMPEDING_WILDEBEESTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STAMPEDING_WILDEBEESTS, "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\nAt the beginning of your upkeep, return a green creature you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return a green creature you control to its owner's hand.", STAMPEDING_WILDEBEESTS.name);
const VOCAB_T_L1 = vocabularyTargets("Return a green creature you control to its owner's hand.");

export const STAMPEDING_WILDEBEESTS_SCRIPT: CardScript = {
  oracleId: STAMPEDING_WILDEBEESTS.oracleId,
  name: STAMPEDING_WILDEBEESTS.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Stampeding Wildebeests - Return a green creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
