// `Scoria Wurm` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCORIA_WURM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCORIA_WURM, "At the beginning of your upkeep, flip a coin. If you lose the flip, return this creature to its owner's hand.");

const VOCAB_L0 = vocabularyEffects("Flip a coin. If you lose the flip, return this creature to its owner's hand.", SCORIA_WURM.name);
const VOCAB_T_L0 = vocabularyTargets("Flip a coin. If you lose the flip, return this creature to its owner's hand.");

export const SCORIA_WURM_SCRIPT: CardScript = {
  oracleId: SCORIA_WURM.oracleId,
  name: SCORIA_WURM.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Scoria Wurm - Flip a coin. If you lose the flip, return this creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
