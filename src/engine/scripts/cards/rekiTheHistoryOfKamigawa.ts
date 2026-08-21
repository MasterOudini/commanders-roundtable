// `Reki, the History of Kamigawa` — "Whenever you cast a legendary
// spell, draw a card." The cast-watcher filtered on the cast face's
// SUPERTYPE. D238.

import { REKI_THE_HISTORY_OF_KAMIGAWA } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  REKI_THE_HISTORY_OF_KAMIGAWA,
  'Whenever you cast a legendary spell, draw a card.',
);

export const REKI_THE_HISTORY_OF_KAMIGAWA_SCRIPT: CardScript = {
  oracleId: REKI_THE_HISTORY_OF_KAMIGAWA.oracleId,
  name: REKI_THE_HISTORY_OF_KAMIGAWA.name,
  triggers: [
    {
      abilityId: 'legendary-cast',
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
        return faceOf(oc, ev.obj.faceIndex).typeLine.supertypes.includes('Legendary');
      },
      label: () => 'Reki, the History of Kamigawa — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
