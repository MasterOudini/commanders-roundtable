// `Nine-Tail White Fox` — "Whenever this creature deals combat damage to a
// player, draw a card." Belligerent Guest's self-only hit paying a draw.
// D228.

import { NINE_TAIL_WHITE_FOX } from '../../../data/fixtures/engineCards';
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
  NINE_TAIL_WHITE_FOX,
  'Whenever this creature deals combat damage to a player, draw a card.',
);

export const NINE_TAIL_WHITE_FOX_SCRIPT: CardScript = {
  oracleId: NINE_TAIL_WHITE_FOX.oracleId,
  name: NINE_TAIL_WHITE_FOX.name,
  triggers: [
    {
      abilityId: 'hit-draw',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Nine-Tail White Fox — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
