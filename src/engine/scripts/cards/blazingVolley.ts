// `Blazing Volley` — "Blazing Volley deals 1 damage to each creature your
// opponents control." One simultaneous batch over the opposing boards; the
// spell is the source, no riders. D200.

import { BLAZING_VOLLEY } from '../../../data/fixtures/engineCards';
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
  BLAZING_VOLLEY,
  'Blazing Volley deals 1 damage to each creature your opponents control.',
);

export const BLAZING_VOLLEY_SCRIPT: CardScript = {
  oracleId: BLAZING_VOLLEY.oracleId,
  name: BLAZING_VOLLEY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 1,
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
