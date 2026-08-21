// `Soulknife Spy` — Scroll Thief's connect draw on a second id-shape: the
// self-only combat-damage filter is granularity-safe. D250.

import { SOULKNIFE_SPY } from '../../../data/fixtures/engineCards';
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
  SOULKNIFE_SPY,
  'Whenever this creature deals combat damage to a player, draw a card.',
);

export const SOULKNIFE_SPY_SCRIPT: CardScript = {
  oracleId: SOULKNIFE_SPY.oracleId,
  name: SOULKNIFE_SPY.name,
  triggers: [
    {
      abilityId: 'connect',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Soulknife Spy — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
