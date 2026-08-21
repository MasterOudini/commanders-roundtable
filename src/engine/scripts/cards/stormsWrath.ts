// `Storm's Wrath` — Star of Extinction's sweep at 4: every creature and
// every planeswalker, one batch. D253.

import { STORM_S_WRATH } from '../../../data/fixtures/engineCards';
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
  STORM_S_WRATH,
  "Storm's Wrath deals 4 damage to each creature and each planeswalker.",
);

export const STORMS_WRATH_SCRIPT: CardScript = {
  oracleId: STORM_S_WRATH.oracleId,
  name: STORM_S_WRATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const types = ctx.derive(id).typeLine.types;
        if (!types.includes('Creature') && !types.includes('Planeswalker')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 4,
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
