// `Shower of Sparks` — "deals 1 damage to target creature and 1 damage
// to target player or planeswalker." TWO probed specs; the mixed fan on
// the hit() helper. D247.

import { SHOWER_OF_SPARKS } from '../../../data/fixtures/engineCards';
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
  SHOWER_OF_SPARKS,
  'Shower of Sparks deals 1 damage to target creature and 1 damage to target player or planeswalker.',
);

export const SHOWER_OF_SPARKS_SCRIPT: CardScript = {
  oracleId: SHOWER_OF_SPARKS.oracleId,
  name: SHOWER_OF_SPARKS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const creature = obj.targets[0];
      const second = obj.targets[1];
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
      const damages = [];
      if (
        creature &&
        creature.kind === 'card' &&
        ctx.state.cards[creature.id]?.zone.kind === 'battlefield'
      ) {
        damages.push(hit({ kind: 'card', id: creature.id }, 1));
      }
      if (second && second.kind === 'player') {
        damages.push(hit({ kind: 'player', id: second.id }, 1));
      } else if (
        second &&
        second.kind === 'card' &&
        ctx.state.cards[second.id]?.zone.kind === 'battlefield'
      ) {
        damages.push(hit({ kind: 'card', id: second.id }, 1));
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
