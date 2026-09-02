// `Cunning Strike` — "Cunning Strike deals 2 damage to target creature and
// 2 damage to target player or planeswalker.\nDraw a card." Two specs of
// different kinds, read IN SPEC ORDER: the first is a creature, the second
// a player or a planeswalker (Chandra's Fury's compound half, D203). Reading
// by position is exact here because CR 608.2b's re-check only ever lets a
// spec-ordered answer resolve (D255/D271 — an out-of-order answer fizzles
// before this runs), and "by controller" cannot tell a creature from a
// planeswalker. One DamageDealt carries both hits; then the draw. D274.

import { CUNNING_STRIKE } from '../../../data/fixtures/engineCards';
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
  CUNNING_STRIKE,
  'Cunning Strike deals 2 damage to target creature and 2 damage to target player or planeswalker.\nDraw a card.',
);

export const CUNNING_STRIKE_SCRIPT: CardScript = {
  oracleId: CUNNING_STRIKE.oracleId,
  name: CUNNING_STRIKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const first = obj.targets[0];
      const second = obj.targets[1];
      if (!first || !second || first.kind !== 'card' || second.kind === 'stack') return [];
      const hit = (to: { kind: 'card'; id: string } | { kind: 'player'; id: string }) => ({
        source: self,
        target: to,
        amount: 2,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const damages = [];
      if (ctx.state.cards[first.id]?.zone.kind === 'battlefield') {
        damages.push(hit({ kind: 'card', id: first.id }));
      }
      if (second.kind === 'player') {
        const them = ctx.state.players[second.id];
        if (them && !them.hasLost) damages.push(hit({ kind: 'player', id: second.id }));
      } else if (ctx.state.cards[second.id]?.zone.kind === 'battlefield') {
        damages.push(hit({ kind: 'card', id: second.id }));
      }
      const events: EventBody[] = [];
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
