// `Martial Law` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARTIAL_LAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARTIAL_LAW, "At the beginning of your upkeep, detain target creature an opponent controls. (Until your next turn, that creature can't attack or block and its activated abilities can't be activated.)");

const VOCAB_L0 = vocabularyEffects("Detain target creature an opponent controls.", MARTIAL_LAW.name);
const VOCAB_T_L0 = vocabularyTargets("Detain target creature an opponent controls.");

export const MARTIAL_LAW_SCRIPT: CardScript = {
  oracleId: MARTIAL_LAW.oracleId,
  name: MARTIAL_LAW.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Martial Law - Detain target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
