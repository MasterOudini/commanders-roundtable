// `Typhoon` — the PER-OPPONENT census: each opponent takes their OWN Island
// count, not a shared number (Incite Rebellion's shape, D219). An opponent
// with no Islands takes nothing at all rather than a 0-damage entry. D263.

import { TYPHOON } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  TYPHOON,
  'Typhoon deals damage to each opponent equal to the number of Islands that player controls.',
);

export const TYPHOON_SCRIPT: CardScript = {
  oracleId: TYPHOON.oracleId,
  name: TYPHOON.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages: {
        source: InstanceId;
        target: { kind: 'player'; id: string };
        amount: number;
        deathtouch: boolean;
        lifelinkTo: null;
        isCommanderDamage: boolean;
        viaTrample: number;
        toxic: number;
        applyAs: 'normal';
      }[] = [];
      for (const p of ctx.state.seating) {
        if (p === obj.controller) continue;
        const player = ctx.state.players[p];
        if (!player || player.hasLost) continue;
        let islands = 0;
        for (const id of ctx.state.zones.battlefield) {
          const inst = ctx.state.cards[id];
          if (!inst || inst.controller !== p) continue;
          if (ctx.derive(id).typeLine.subtypes.includes('Island')) islands += 1;
        }
        if (islands <= 0) continue;
        damages.push({
          source: self,
          target: { kind: 'player', id: p },
          amount: islands,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal',
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
