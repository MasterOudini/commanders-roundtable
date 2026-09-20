// `Shimmerwing Chimera` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHIMMERWING_CHIMERA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHIMMERWING_CHIMERA, "Flying\nAt the beginning of your upkeep, return up to one other target enchantment you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return up to one other target enchantment you control to its owner's hand.", SHIMMERWING_CHIMERA.name);
const VOCAB_T_L1 = vocabularyTargets("Return up to one other target enchantment you control to its owner's hand.");

export const SHIMMERWING_CHIMERA_SCRIPT: CardScript = {
  oracleId: SHIMMERWING_CHIMERA.oracleId,
  name: SHIMMERWING_CHIMERA.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Shimmerwing Chimera - Return up to one other target enchantment you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
