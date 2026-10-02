// `Mind Unbound` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIND_UNBOUND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIND_UNBOUND, "At the beginning of your upkeep, put a lore counter on this enchantment, then draw a card for each lore counter on this enchantment.");

const VOCAB_L0 = vocabularyEffects("Put a lore counter on this enchantment, then draw a card for each lore counter on this enchantment.", MIND_UNBOUND.name);
const VOCAB_T_L0 = vocabularyTargets("Put a lore counter on this enchantment, then draw a card for each lore counter on this enchantment.");

export const MIND_UNBOUND_SCRIPT: CardScript = {
  oracleId: MIND_UNBOUND.oracleId,
  name: MIND_UNBOUND.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Mind Unbound - Put a lore counter on this enchantment, then draw a card for each lore counter on this enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
