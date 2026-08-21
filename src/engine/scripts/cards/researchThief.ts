// `Research Thief` — "Whenever an artifact creature you control deals
// combat damage to a player, draw a card." Keeper of Fables' derived
// dealer read with a two-type filter; the Flash and Flying lines are
// the engine's. D239.

import { RESEARCH_THIEF } from '../../../data/fixtures/engineCards';
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
  RESEARCH_THIEF,
  'Flash\nFlying\nWhenever an artifact creature you control deals combat damage to a player, draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const RESEARCH_THIEF_SCRIPT: CardScript = {
  oracleId: RESEARCH_THIEF.oracleId,
  name: RESEARCH_THIEF.name,
  triggers: [
    {
      abilityId: 'artifact-connect',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => {
          if (d.target.kind !== 'player' || d.amount <= 0) return false;
          const inst = ctx.state.cards[d.source];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          const types = ctx.derive(d.source).typeLine.types;
          return types.includes('Artifact') && types.includes('Creature');
        }),
      label: () => 'Research Thief — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
