// `Dual Shot` — 1 damage to each of up to two target creatures, one damage
// entry per creature still on the battlefield.

import { DUAL_SHOT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DUAL_SHOT, 'Dual Shot deals 1 damage to each of up to two target creatures.');

export const DUAL_SHOT_SCRIPT: CardScript = {
  oracleId: DUAL_SHOT.oracleId,
  name: DUAL_SHOT.name,
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
          amount: 1,
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
