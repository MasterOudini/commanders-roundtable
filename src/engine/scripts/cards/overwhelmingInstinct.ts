// `Overwhelming Instinct` — "Whenever you attack with three or more
// creatures, draw a card." Military Intelligence's threshold at three.
// D231.

import { OVERWHELMING_INSTINCT } from '../../../data/fixtures/engineCards';
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
  OVERWHELMING_INSTINCT,
  'Whenever you attack with three or more creatures, draw a card.',
);

export const OVERWHELMING_INSTINCT_SCRIPT: CardScript = {
  oracleId: OVERWHELMING_INSTINCT.oracleId,
  name: OVERWHELMING_INSTINCT.name,
  triggers: [
    {
      abilityId: 'three-attackers-draw',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.filter((a) => ctx.query.controllerOf(a.card) === ctx.query.controllerOf(self))
          .length >= 3,
      label: () => 'Overwhelming Instinct — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
