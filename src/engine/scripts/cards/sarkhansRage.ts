// `Sarkhan's Rage` — "deals 5 damage to any target. If you control no
// Dragons, deals 2 damage to you." Rending Flame's conditional recoil
// with the census on MY board, read at resolution; the mixed fan rides
// Chandra's Fury's hit() helper. D243.

import { SARKHAN_S_RAGE } from '../../../data/fixtures/engineCards';
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
  SARKHAN_S_RAGE,
  "Sarkhan's Rage deals 5 damage to any target. If you control no Dragons, Sarkhan's Rage deals 2 damage to you.",
);

export const SARKHANS_RAGE_SCRIPT: CardScript = {
  oracleId: SARKHAN_S_RAGE.oracleId,
  name: SARKHAN_S_RAGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
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
      let dragons = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Dragon')) dragons++;
      }
      const damages = [
        hit(
          target.kind === 'player'
            ? { kind: 'player', id: target.id }
            : { kind: 'card', id: target.id },
          5,
        ),
      ];
      if (dragons === 0) damages.push(hit({ kind: 'player', id: obj.controller }, 2));
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
