// `Lavalanche` — X at the player (or planeswalker) AND X at each
// creature that seat controls: the fan keyed off the target's
// controller. D222.

import { LAVALANCHE } from '../../../data/fixtures/engineCards';
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
  LAVALANCHE,
  "Lavalanche deals X damage to target player or planeswalker and each creature that player or that planeswalker's controller controls.",
);

export const LAVALANCHE_SCRIPT: CardScript = {
  oracleId: LAVALANCHE.oracleId,
  name: LAVALANCHE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      let seat: string | null = null;
      const damages = [];
      if (target.kind === 'player') {
        if (ctx.state.players[target.id]?.hasLost) return [];
        seat = target.id;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: target.id },
          amount: x,
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
        seat = card.controller;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: target.id },
          amount: x,
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
        if (!card || card.controller !== seat) continue;
        if (target.kind === 'card' && id === target.id) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: x,
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
