// `Forgotten Harvest` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORGOTTEN_HARVEST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORGOTTEN_HARVEST, "At the beginning of your upkeep, you may exile a land card from your graveyard. If you do, put a +1/+1 counter on target creature.");

const VOCAB_L0 = vocabularyEffects("You may exile a land card from your graveyard. If you do, put a +1/+1 counter on target creature.", FORGOTTEN_HARVEST.name);
const VOCAB_T_L0 = vocabularyTargets("You may exile a land card from your graveyard. If you do, put a +1/+1 counter on target creature.");

export const FORGOTTEN_HARVEST_SCRIPT: CardScript = {
  oracleId: FORGOTTEN_HARVEST.oracleId,
  name: FORGOTTEN_HARVEST.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Forgotten Harvest - You may exile a land card from your graveyard. If you do, put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
