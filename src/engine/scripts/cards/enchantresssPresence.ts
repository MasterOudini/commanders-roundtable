// `Enchantress's Presence` — "Whenever you cast an enchantment spell, draw
// a card." Argothian Enchantress's exact filter as an enchantment itself.
// M6.4q, D173.

import { ENCHANTRESS_S_PRESENCE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ENCHANTRESS_S_PRESENCE, 'Whenever you cast an enchantment spell, draw a card.');

export const ENCHANTRESSS_PRESENCE_SCRIPT: CardScript = {
  oracleId: ENCHANTRESS_S_PRESENCE.oracleId,
  name: ENCHANTRESS_S_PRESENCE.name,
  triggers: [
    {
      abilityId: 'enchantment-cast',
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
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).typeLine.types.includes('Enchantment');
      },
      label: () => "Enchantress's Presence — draw a card",
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
