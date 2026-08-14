// `Hatching Plans` — "When this enchantment is put into a graveyard from the
// battlefield, draw three cards." The dies trigger under its long-form
// wording, on an ENCHANTMENT that wants to die: same filter as Grasping
// Longneck's "dies", the payoff through the one draw rule. M6.4w, D179.

import { HATCHING_PLANS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(
  HATCHING_PLANS,
  'When this enchantment is put into a graveyard from the battlefield, draw three cards.',
);

export const HATCHING_PLANS_SCRIPT: CardScript = {
  oracleId: HATCHING_PLANS.oracleId,
  name: HATCHING_PLANS.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Hatching Plans — draw three cards',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 3),
    },
  ],
};
