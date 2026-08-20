// `Misthios's Fury` — "Misthios's Fury deals 3 damage to target creature.
// If you control an Equipment, Misthios's Fury also deals 2 damage to that
// creature's controller." Flames of the Raze-Boar's conditional rider: the
// board query is a derived-SUBTYPE census, and the controller is read
// before anything moves. D225.

import { MISTHIOS_S_FURY } from '../../../data/fixtures/engineCards';
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
  MISTHIOS_S_FURY,
  "Misthios's Fury deals 3 damage to target creature. If you control an Equipment, Misthios's Fury also deals 2 damage to that creature's controller.",
);

export const MISTHIOSS_FURY_SCRIPT: CardScript = {
  oracleId: MISTHIOS_S_FURY.oracleId,
  name: MISTHIOS_S_FURY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const hasEquipment = ctx.state.zones.battlefield.some((id) => {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) return false;
        return ctx.derive(id).typeLine.subtypes.includes('Equipment');
      });
      const damages = [];
      damages.push({
        source: self,
        target: { kind: 'card' as const, id: target.id },
        amount: 3,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      if (hasEquipment) {
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: controller },
          amount: 2,
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
