// `Sizzle` — "Sizzle deals 3 damage to each opponent." Boltwave's twin at 3.
// D248.

import { SIZZLE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SIZZLE, 'Sizzle deals 3 damage to each opponent.');

export const SIZZLE_SCRIPT: CardScript = {
  oracleId: SIZZLE.oracleId,
  name: SIZZLE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
          amount: 3,
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
