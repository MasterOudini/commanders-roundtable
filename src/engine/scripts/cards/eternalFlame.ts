// `Eternal Flame` — "Eternal Flame deals X damage to target opponent or
// planeswalker and half X damage, rounded up, to you, where X is the
// number of Mountains you control." The recoil is ceil(X/2) to the CASTER,
// both halves off one Mountain count. D211.

import { ETERNAL_FLAME } from '../../../data/fixtures/engineCards';
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
  ETERNAL_FLAME,
  'Eternal Flame deals X damage to target opponent or planeswalker and half X damage, rounded up, to you, where X is the number of Mountains you control.',
);

export const ETERNAL_FLAME_SCRIPT: CardScript = {
  oracleId: ETERNAL_FLAME.oracleId,
  name: ETERNAL_FLAME.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Mountain')) x++;
      }
      if (x <= 0) return [];
      const damages = [
        {
          source: self,
          target:
            target.kind === 'player'
              ? { kind: 'player' as const, id: target.id }
              : { kind: 'card' as const, id: target.id },
          amount: x,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        },
      ];
      if (!ctx.state.players[obj.controller]?.hasLost) {
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: obj.controller },
          amount: Math.ceil(x / 2),
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
