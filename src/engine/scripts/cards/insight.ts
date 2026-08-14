// `Insight` — "Whenever an opponent casts a green spell, you draw a card."
// Arasta's opponent filter with Hero of Precinct One's colour access: the
// COLOURS of the face actually cast, and the draw goes to Insight's
// controller, not the caster. M6.4x, D180.

import { INSIGHT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { faceOf } from '../../oracle';
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

const TEXT = printed(INSIGHT, 'Whenever an opponent casts a green spell, you draw a card.');

export const INSIGHT_SCRIPT: CardScript = {
  oracleId: INSIGHT.oracleId,
  name: INSIGHT.name,
  triggers: [
    {
      abilityId: 'cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller === ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const face = faceOf(oc, ev.obj.faceIndex);
        return face.colors.includes('G');
      },
      label: () => 'Insight — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
