// `Satyr Enchanter` — "Whenever you cast an enchantment spell, draw a
// card." Argothian Enchantress's filter paying a draw. D243.

import { SATYR_ENCHANTER } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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

const TEXT = printed(SATYR_ENCHANTER, 'Whenever you cast an enchantment spell, draw a card.');

export const SATYR_ENCHANTER_SCRIPT: CardScript = {
  oracleId: SATYR_ENCHANTER.oracleId,
  name: SATYR_ENCHANTER.name,
  triggers: [
    {
      abilityId: 'cast-draw',
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
      label: () => 'Satyr Enchanter — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
