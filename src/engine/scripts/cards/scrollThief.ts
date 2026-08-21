// `Scroll Thief` — "Whenever this creature deals combat damage to a
// player, draw a card." The classic connect draw. D244.

import { SCROLL_THIEF } from '../../../data/fixtures/engineCards';
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
  SCROLL_THIEF,
  'Whenever this creature deals combat damage to a player, draw a card.',
);

export const SCROLL_THIEF_SCRIPT: CardScript = {
  oracleId: SCROLL_THIEF.oracleId,
  name: SCROLL_THIEF.name,
  triggers: [
    {
      abilityId: 'hit-player-draw',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Scroll Thief — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
