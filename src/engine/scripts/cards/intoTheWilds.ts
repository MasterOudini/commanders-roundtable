// `Into the Wilds` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INTO_THE_WILDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INTO_THE_WILDS, "At the beginning of your upkeep, look at the top card of your library. If it's a land card, you may put it onto the battlefield.");

const VOCAB_L0 = vocabularyEffects("Look at the top card of your library. If it's a land card, you may put it onto the battlefield.", INTO_THE_WILDS.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top card of your library. If it's a land card, you may put it onto the battlefield.");

export const INTO_THE_WILDS_SCRIPT: CardScript = {
  oracleId: INTO_THE_WILDS.oracleId,
  name: INTO_THE_WILDS.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Into the Wilds - Look at the top card of your library. If it's a land card, you may put it onto the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
