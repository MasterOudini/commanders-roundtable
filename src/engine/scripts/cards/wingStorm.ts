// `Wing Storm` — damage to EACH player equal to TWICE the flyers that player
// controls. Per-player arithmetic, so the two seats take different amounts
// from one resolve, and a player with no flyers takes nothing rather than a
// zero-amount entry. D269.

import { WING_STORM } from '../../../data/fixtures/engineCards';
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
  WING_STORM,
  'Wing Storm deals damage to each player equal to twice the number of creatures that player controls with flying.',
);

export const WING_STORM_SCRIPT: CardScript = {
  oracleId: WING_STORM.oracleId,
  name: WING_STORM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self): readonly EventBody[] => {
      const flyers = new Map<string, number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.keywords.has('flying')) continue;
        flyers.set(card.controller, (flyers.get(card.controller) ?? 0) + 1);
      }

      const damages = [];
      for (const p of ctx.state.seating) {
        const player = ctx.state.players[p];
        if (!player || player.hasLost) continue;
        const amount = (flyers.get(p) ?? 0) * 2;
        if (amount === 0) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: p },
          amount,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
