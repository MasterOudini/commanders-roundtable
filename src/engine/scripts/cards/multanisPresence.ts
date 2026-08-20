// `Multani's Presence` — "Whenever a spell you've cast is countered, draw a
// card." The FIRST `SpellCountered` consumer: the countered spell is
// already leaving in the same batch, so the def looks BACK and reads its
// controller off the before-state's stack. D227.

import { MULTANI_S_PRESENCE } from '../../../data/fixtures/engineCards';
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
  MULTANI_S_PRESENCE,
  "Whenever a spell you've cast is countered, draw a card.",
);

export const MULTANIS_PRESENCE_SCRIPT: CardScript = {
  oracleId: MULTANI_S_PRESENCE.oracleId,
  name: MULTANI_S_PRESENCE.name,
  triggers: [
    {
      abilityId: 'countered-draw',
      text: TEXT,
      event: 'SpellCountered',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCountered') return false;
        const spell = ctx.state.stack.find((s) => s.id === ev.stackId);
        return !!spell && spell.controller === ctx.query.controllerOf(self);
      },
      label: () => "Multani's Presence — draw a card",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
