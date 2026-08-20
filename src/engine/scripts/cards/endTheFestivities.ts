// `End the Festivities` — "End the Festivities deals 1 damage to each
// opponent and each creature and planeswalker they control." The caster's
// side is untouched on every half. D210.

import { END_THE_FESTIVITIES } from '../../../data/fixtures/engineCards';
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
  END_THE_FESTIVITIES,
  'End the Festivities deals 1 damage to each opponent and each creature and planeswalker they control.',
);

export const END_THE_FESTIVITIES_SCRIPT: CardScript = {
  oracleId: END_THE_FESTIVITIES.oracleId,
  name: END_THE_FESTIVITIES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        const types = ctx.derive(id).typeLine.types;
        if (!types.includes('Creature') && !types.includes('Planeswalker')) continue;
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
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        if (ctx.state.players[pid]?.hasLost) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
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
