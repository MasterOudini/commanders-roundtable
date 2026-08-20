// `Jagged Lightning` — 3 to EACH of the two picks: one spec, two
// arrows, per-target checks. D220.

import { JAGGED_LIGHTNING } from '../../../data/fixtures/engineCards';
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
  JAGGED_LIGHTNING,
  'Jagged Lightning deals 3 damage to each of two target creatures.',
);

export const JAGGED_LIGHTNING_SCRIPT: CardScript = {
  oracleId: JAGGED_LIGHTNING.oracleId,
  name: JAGGED_LIGHTNING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') continue;
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
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
