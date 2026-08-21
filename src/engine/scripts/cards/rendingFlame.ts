// `Rending Flame` — "Rending Flame deals 5 damage to target creature or
// planeswalker. If that permanent is a Spirit, Rending Flame also deals
// 2 damage to that permanent's controller." The compound burn with the
// subtype-conditional recoil, both read BEFORE the damage lands. D239.

import { RENDING_FLAME } from '../../../data/fixtures/engineCards';
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
  RENDING_FLAME,
  "Rending Flame deals 5 damage to target creature or planeswalker. If that permanent is a Spirit, Rending Flame also deals 2 damage to that permanent's controller.",
);

export const RENDING_FLAME_SCRIPT: CardScript = {
  oracleId: RENDING_FLAME.oracleId,
  name: RENDING_FLAME.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const isSpirit = ctx.derive(target.id).typeLine.subtypes.includes('Spirit');
      const controller = card.controller;
      const hit = (
        to: { kind: 'card'; id: string } | { kind: 'player'; id: string },
        amount: number,
      ) => ({
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
      const damages = [hit({ kind: 'card', id: target.id }, 5)];
      if (isSpirit && ctx.state.players[controller] && !ctx.state.players[controller]?.hasLost) {
        damages.push(hit({ kind: 'player', id: controller }, 2));
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
