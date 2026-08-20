// `Military Intelligence` — "Whenever you attack with two or more
// creatures, draw a card." Armasaur Guide's attacker-count threshold on an
// enchantment, paying a draw. D225.

import { MILITARY_INTELLIGENCE } from '../../../data/fixtures/engineCards';
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
  MILITARY_INTELLIGENCE,
  'Whenever you attack with two or more creatures, draw a card.',
);

export const MILITARY_INTELLIGENCE_SCRIPT: CardScript = {
  oracleId: MILITARY_INTELLIGENCE.oracleId,
  name: MILITARY_INTELLIGENCE.name,
  triggers: [
    {
      abilityId: 'two-attackers-draw',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.filter((a) => ctx.query.controllerOf(a.card) === ctx.query.controllerOf(self))
          .length >= 2,
      label: () => 'Military Intelligence — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
