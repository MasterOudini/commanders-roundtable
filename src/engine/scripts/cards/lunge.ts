// `Lunge` — two clauses, two arrows: 2 at the creature, 2 at the player
// or planeswalker (Hungry Flames' shape at 2/2). D223.

import { LUNGE } from '../../../data/fixtures/engineCards';
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
  LUNGE,
  'Lunge deals 2 damage to target creature and 2 damage to target player or planeswalker.',
);

export const LUNGE_SCRIPT: CardScript = {
  oracleId: LUNGE.oracleId,
  name: LUNGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const creature = obj.targets[0];
      const second = obj.targets[1];
      const damages = [];
      if (
        creature &&
        creature.kind === 'card' &&
        ctx.state.cards[creature.id]?.zone.kind === 'battlefield'
      ) {
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: creature.id },
          amount: 2,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (second && second.kind === 'player' && !ctx.state.players[second.id]?.hasLost) {
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: second.id },
          amount: 2,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      } else if (
        second &&
        second.kind === 'card' &&
        ctx.state.cards[second.id]?.zone.kind === 'battlefield'
      ) {
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: second.id },
          amount: 2,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
