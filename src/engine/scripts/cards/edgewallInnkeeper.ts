// `Edgewall Innkeeper` — "Whenever you cast a creature spell that has an
// Adventure, draw a card." The FIRST cast filter on a card's LAYOUT (D173):
// "has an Adventure" is a fact about the printing, so the filter asks the
// oracle for `layout === 'adventure'` and the cast face for Creature — cast
// as the creature, not on the adventure (the reminder text's own rule).
// M6.4q, D173.

import { EDGEWALL_INNKEEPER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  EDGEWALL_INNKEEPER,
  'Whenever you cast a creature spell that has an Adventure, draw a card. ' +
    "(It doesn't need to have gone on the adventure first.)",
);

export const EDGEWALL_INNKEEPER_SCRIPT: CardScript = {
  oracleId: EDGEWALL_INNKEEPER.oracleId,
  name: EDGEWALL_INNKEEPER.name,
  triggers: [
    {
      abilityId: 'adventure-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc || oc.layout !== 'adventure') return false;
        return faceOf(oc, ev.obj.faceIndex).typeLine.types.includes('Creature');
      },
      label: () => 'Edgewall Innkeeper — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
