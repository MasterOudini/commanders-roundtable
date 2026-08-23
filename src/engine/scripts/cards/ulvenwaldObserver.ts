// `Ulvenwald Observer` — the dies watcher with a DERIVED-toughness floor
// (Sultai Flayer's shape, D255).
//
// ⚠️ It looks back, so the toughness is read off the board the creature DIED
// on (CR 603.10a) — a creature killed by a -X/-X effect is measured as it was
// when it left, which is the reading the card wants. The Observer's own death
// counts too: it is "a creature you control" like any other. D263.

import { ULVENWALD_OBSERVER } from '../../../data/fixtures/engineCards';
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
  ULVENWALD_OBSERVER,
  'Whenever a creature you control with toughness 4 or greater dies, draw a card.',
);

export const ULVENWALD_OBSERVER_SCRIPT: CardScript = {
  oracleId: ULVENWALD_OBSERVER.oracleId,
  name: ULVENWALD_OBSERVER.name,
  triggers: [
    {
      abilityId: 'big-dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== mine) return false;
          const d = ctx.derive(m.card);
          return d.typeLine.types.includes('Creature') && (d.toughness ?? 0) >= 4;
        });
      },
      label: () => 'Ulvenwald Observer — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
