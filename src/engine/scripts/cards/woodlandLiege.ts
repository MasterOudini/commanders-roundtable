// `Woodland Liege` — "Whenever a Beast you control enters, draw a card."
//
// ⚠️ TWO defs for the one printed line: a card enters via `CardsMoved`, a
// token via `TokenCreated`, and the bus dispatches on exact event kind
// (D158's rule). The line says "a Beast", not "another", so the Liege's own
// entry WOULD pay if it were a Beast — it is an Elf Druid Noble, so the
// question never arises, and no is-it-me check belongs here. D270.

import { WOODLAND_LIEGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WOODLAND_LIEGE, 'Whenever a Beast you control enters, draw a card.');

export const WOODLAND_LIEGE_SCRIPT: CardScript = {
  oracleId: WOODLAND_LIEGE.oracleId,
  name: WOODLAND_LIEGE.name,
  triggers: [
    {
      abilityId: 'beast-card-enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          if (m.to.player !== mine) return false;
          return ctx.derive(m.card).typeLine.subtypes.includes('Beast');
        });
      },
      label: () => 'Woodland Liege — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
    {
      abilityId: 'beast-token-enters',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'TokenCreated') return false;
        if (ev.controller !== ctx.query.controllerOf(self)) return false;
        return ctx.derive(ev.card).typeLine.subtypes.includes('Beast');
      },
      label: () => 'Woodland Liege — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
