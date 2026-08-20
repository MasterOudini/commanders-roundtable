// `First Volley` — "First Volley deals 1 damage to target creature and 1
// damage to that creature's controller." The controller is read pre-move,
// both points in ONE DamageDealt. D213.

import { FIRST_VOLLEY } from '../../../data/fixtures/engineCards';
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
  FIRST_VOLLEY,
  "First Volley deals 1 damage to target creature and 1 damage to that creature's controller.",
);

export const FIRST_VOLLEY_SCRIPT: CardScript = {
  oracleId: FIRST_VOLLEY.oracleId,
  name: FIRST_VOLLEY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const damages = [];
      damages.push({
        source: self,
        target: { kind: 'card' as const, id: target.id },
        amount: 1,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      if (!ctx.state.players[controller]?.hasLost) {
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: controller },
          amount: 1,
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
