// `Radiating Lightning` — "Radiating Lightning deals 3 damage to target
// player and 1 damage to each creature that player controls." Chandra's
// Fury's fan at instant speed and a flat 3. D236.

import { RADIATING_LIGHTNING } from '../../../data/fixtures/engineCards';
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
  RADIATING_LIGHTNING,
  'Radiating Lightning deals 3 damage to target player and 1 damage to each creature that player controls.',
);

export const RADIATING_LIGHTNING_SCRIPT: CardScript = {
  oracleId: RADIATING_LIGHTNING.oracleId,
  name: RADIATING_LIGHTNING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const player = ctx.state.players[target.id];
      if (!player || player.hasLost) return [];
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
      const damages = [hit({ kind: 'player', id: target.id }, 3)];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push(hit({ kind: 'card', id }, 1));
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
