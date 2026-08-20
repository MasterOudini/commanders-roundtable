// `Hail Storm` — 2 to each ATTACKING creature, 1 to me and each creature
// I control; my own attacker takes both entries. D216.

import { HAIL_STORM } from '../../../data/fixtures/engineCards';
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
  HAIL_STORM,
  'Hail Storm deals 2 damage to each attacking creature and 1 damage to you and each creature you control.',
);

export const HAIL_STORM_SCRIPT: CardScript = {
  oracleId: HAIL_STORM.oracleId,
  name: HAIL_STORM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      for (const a of ctx.state.combat?.attackers ?? []) {
        if (!ctx.state.cards[a.card]) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: a.card },
          amount: 2,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: obj.controller },
          amount: 1,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 1,
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
