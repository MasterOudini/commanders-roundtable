// `Borrowing the East Wind` — "Borrowing the East Wind deals X damage to
// each creature with horsemanship and each player." Squall Line's exact
// shape one keyword over. D201.

import { BORROWING_THE_EAST_WIND } from '../../../data/fixtures/engineCards';
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
  BORROWING_THE_EAST_WIND,
  'Borrowing the East Wind deals X damage to each creature with horsemanship and each player.',
);

export const BORROWING_THE_EAST_WIND_SCRIPT: CardScript = {
  oracleId: BORROWING_THE_EAST_WIND.oracleId,
  name: BORROWING_THE_EAST_WIND.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.keywords.has('horsemanship')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: x,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      for (const pid of ctx.state.seating) {
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
          amount: x,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
