// `Starfall` — 3 to the creature, and 3 to its controller only if the
// creature is an ENCHANTMENT — the condition read on the derived types
// BEFORE the damage lands. Mixed targets ride the hit() closure. D252.

import { STARFALL } from '../../../data/fixtures/engineCards';
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
  STARFALL,
  "Starfall deals 3 damage to target creature. If that creature is an enchantment, Starfall deals 3 damage to that creature's controller.",
);

export const STARFALL_SCRIPT: CardScript = {
  oracleId: STARFALL.oracleId,
  name: STARFALL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const hit = (to: { kind: 'card'; id: string } | { kind: 'player'; id: string }) => ({
        source: self,
        target: to,
        amount: 3,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const isEnchantment = ctx.derive(target.id).typeLine.types.includes('Enchantment');
      const controller = card.controller;
      const damages = [hit({ kind: 'card', id: target.id })];
      if (isEnchantment) damages.push(hit({ kind: 'player', id: controller }));
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
