// `Punish the Enemy` — "Punish the Enemy deals 3 damage to target player
// or planeswalker and 3 damage to target creature." Two probed specs,
// one simultaneous batch. D236.

import { PUNISH_THE_ENEMY } from '../../../data/fixtures/engineCards';
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
  PUNISH_THE_ENEMY,
  'Punish the Enemy deals 3 damage to target player or planeswalker and 3 damage to target creature.',
);

export const PUNISH_THE_ENEMY_SCRIPT: CardScript = {
  oracleId: PUNISH_THE_ENEMY.oracleId,
  name: PUNISH_THE_ENEMY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      const first = obj.targets[0];
      if (first) {
        if (first.kind === 'player' && ctx.state.players[first.id]) {
          damages.push({
            source: self,
            target: { kind: 'player' as const, id: first.id },
            amount: 3,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          });
        } else if (first.kind === 'card' && ctx.state.cards[first.id]?.zone.kind === 'battlefield') {
          damages.push({
            source: self,
            target: { kind: 'card' as const, id: first.id },
            amount: 3,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          });
        }
      }
      const second = obj.targets[1];
      if (second && second.kind === 'card' && ctx.state.cards[second.id]?.zone.kind === 'battlefield') {
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: second.id },
          amount: 3,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      return damages.length > 0 ? [{ t: 'DamageDealt', damages }] : [];
    },
  },
};
