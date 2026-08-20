// `Flame Wave` — "Flame Wave deals 4 damage to target player or
// planeswalker and each creature that player or that planeswalker's
// controller controls." Chandra's Fury's fan: the board hit is the
// TARGET's controller's creatures (the player themself when a player is
// targeted). D213.

import { FLAME_WAVE } from '../../../data/fixtures/engineCards';
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
  FLAME_WAVE,
  "Flame Wave deals 4 damage to target player or planeswalker and each creature that player or that planeswalker's controller controls.",
);

export const FLAME_WAVE_SCRIPT: CardScript = {
  oracleId: FLAME_WAVE.oracleId,
  name: FLAME_WAVE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      let owner: string | null = null;
      const damages = [];
      if (target.kind === 'player') {
        if (ctx.state.players[target.id]?.hasLost) return [];
        owner = target.id;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: target.id },
          amount: 4,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      } else {
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        owner = card.controller;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: target.id },
          amount: 4,
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
        if (!card || card.controller !== owner || id === target.id) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 4,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
