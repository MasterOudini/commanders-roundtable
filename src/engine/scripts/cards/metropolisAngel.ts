// `Metropolis Angel` — "Whenever you attack with one or more creatures with
// counters on them, draw a card." Mavren Fein's attack filter keyed on the
// INSTANCE fact: any counter of any kind on any of my declared attackers,
// once per declaration (the printed "one or more"). D224.

import { METROPOLIS_ANGEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  METROPOLIS_ANGEL,
  'Flying\nWhenever you attack with one or more creatures with counters on them, draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const METROPOLIS_ANGEL_SCRIPT: CardScript = {
  oracleId: METROPOLIS_ANGEL.oracleId,
  name: METROPOLIS_ANGEL.name,
  triggers: [
    {
      abilityId: 'countered-attack-draw',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.some((a) => {
          if (ctx.query.controllerOf(a.card) !== ctx.query.controllerOf(self)) return false;
          const counters = ctx.state.cards[a.card]?.counters ?? {};
          return Object.values(counters).some((n) => n > 0);
        }),
      label: () => 'Metropolis Angel — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
