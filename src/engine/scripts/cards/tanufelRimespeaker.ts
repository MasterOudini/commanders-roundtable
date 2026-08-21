// `Tanufel Rimespeaker` — the MV>=4 cast draw (Skybeast Tracker's filter
// one number down, paying a card instead of a Food). D256.

import { TANUFEL_RIMESPEAKER } from '../../../data/fixtures/engineCards';
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
  TANUFEL_RIMESPEAKER,
  'Whenever you cast a spell with mana value 4 or greater, draw a card.',
);

export const TANUFEL_RIMESPEAKER_SCRIPT: CardScript = {
  oracleId: TANUFEL_RIMESPEAKER.oracleId,
  name: TANUFEL_RIMESPEAKER.name,
  triggers: [
    {
      abilityId: 'big-cast',
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
        return oc.manaValue >= 4;
      },
      label: () => 'Tanufel Rimespeaker — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
