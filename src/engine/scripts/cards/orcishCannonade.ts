// `Orcish Cannonade` — "Orcish Cannonade deals 2 damage to any target and 3
// damage to you.\nDraw a card." One DamageDealt carrying both hits (Char's
// self-damage half, the spell itself as the source), then the draw. D278.

import { ORCISH_CANNONADE } from '../../../data/fixtures/engineCards';
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
  ORCISH_CANNONADE,
  'Orcish Cannonade deals 2 damage to any target and 3 damage to you.\nDraw a card.',
);

export const ORCISH_CANNONADE_SCRIPT: CardScript = {
  oracleId: ORCISH_CANNONADE.oracleId,
  name: ORCISH_CANNONADE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const hit = (to: { kind: 'card'; id: string } | { kind: 'player'; id: string }, amount: number) => ({
        source: self,
        target: to,
        amount,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const damages = [];
      if (target.kind === 'player') {
        const them = ctx.state.players[target.id];
        if (them && !them.hasLost) damages.push(hit({ kind: 'player', id: target.id }, 2));
      } else {
        damages.push(hit({ kind: 'card', id: target.id }, 2));
      }
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) damages.push(hit({ kind: 'player', id: obj.controller }, 3));
      const events: EventBody[] = [];
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
