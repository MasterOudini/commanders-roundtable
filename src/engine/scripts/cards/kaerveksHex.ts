// `Kaervek's Hex` — 1 to each nonblack creature plus 1 more to each
// green one: summed per creature, one entry each. D221.

import { KAERVEK_S_HEX } from '../../../data/fixtures/engineCards';
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
  KAERVEK_S_HEX,
  "Kaervek's Hex deals 1 damage to each nonblack creature and an additional 1 damage to each green creature.",
);

export const KAERVEKS_HEX_SCRIPT: CardScript = {
  oracleId: KAERVEK_S_HEX.oracleId,
  name: KAERVEK_S_HEX.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        const amount = (d.colors.includes('B') ? 0 : 1) + (d.colors.includes('G') ? 1 : 0);
        if (amount === 0) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount,
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
