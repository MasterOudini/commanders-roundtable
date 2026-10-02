// `Cephalid Vandal` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CEPHALID_VANDAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CEPHALID_VANDAL, "At the beginning of your upkeep, put a shred counter on this creature. Then mill a card for each shred counter on this creature.");

const VOCAB_L0 = vocabularyEffects("Put a shred counter on this creature. Then mill a card for each shred counter on ~.", CEPHALID_VANDAL.name);
const VOCAB_T_L0 = vocabularyTargets("Put a shred counter on this creature. Then mill a card for each shred counter on ~.");

export const CEPHALID_VANDAL_SCRIPT: CardScript = {
  oracleId: CEPHALID_VANDAL.oracleId,
  name: CEPHALID_VANDAL.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Cephalid Vandal - Put a shred counter on this creature. Then mill a card for each shred counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
