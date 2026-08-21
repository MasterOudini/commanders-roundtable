// `Swirling Sandstorm` — the THRESHOLD conditional: a seven-card graveyard
// census gates a flying-exempt sweep. The ability word is part of the
// printed line and the def claims it whole. D256.

import { SWIRLING_SANDSTORM } from '../../../data/fixtures/engineCards';
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
  SWIRLING_SANDSTORM,
  'Threshold — Swirling Sandstorm deals 5 damage to each creature without flying if there are seven or more cards in your graveyard.',
);

export const SWIRLING_SANDSTORM_SCRIPT: CardScript = {
  oracleId: SWIRLING_SANDSTORM.oracleId,
  name: SWIRLING_SANDSTORM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const graveyard = ctx.state.zones.graveyard[obj.controller] ?? [];
      if (graveyard.length < 7) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('flying')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 5,
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
