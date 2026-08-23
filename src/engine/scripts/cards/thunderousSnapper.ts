// `Thunderous Snapper` — Tanufel Rimespeaker's mana-value cast filter (D257)
// one number up. The mana value is read off the ORACLE card, so a spell cast
// for an alternative cost still counts at its printed value. D260.

import { THUNDEROUS_SNAPPER } from '../../../data/fixtures/engineCards';
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
  THUNDEROUS_SNAPPER,
  'Whenever you cast a spell with mana value 5 or greater, draw a card.',
);

export const THUNDEROUS_SNAPPER_SCRIPT: CardScript = {
  oracleId: THUNDEROUS_SNAPPER.oracleId,
  name: THUNDEROUS_SNAPPER.name,
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
        return oc.manaValue >= 5;
      },
      label: () => 'Thunderous Snapper — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
