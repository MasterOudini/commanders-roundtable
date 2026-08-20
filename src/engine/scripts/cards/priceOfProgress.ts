// `Price of Progress` — "Price of Progress deals damage to each player
// equal to twice the number of nonbasic lands that player controls."
// Incite Rebellion's per-player census fan, priced in land tax. D234.

import { PRICE_OF_PROGRESS } from '../../../data/fixtures/engineCards';
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
  PRICE_OF_PROGRESS,
  'Price of Progress deals damage to each player equal to twice the number of nonbasic lands that player controls.',
);

export const PRICE_OF_PROGRESS_SCRIPT: CardScript = {
  oracleId: PRICE_OF_PROGRESS.oracleId,
  name: PRICE_OF_PROGRESS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const seat of ctx.state.seating) {
        const player = ctx.state.players[seat];
        if (!player || player.hasLost) continue;
        let nonbasics = 0;
        for (const id of ctx.state.zones.battlefield) {
          const card = ctx.state.cards[id];
          if (!card || card.controller !== seat) continue;
          const d = ctx.derive(id);
          if (!d.typeLine.types.includes('Land')) continue;
          if (d.typeLine.supertypes.includes('Basic')) continue;
          nonbasics++;
        }
        const amount = 2 * nonbasics;
        if (amount === 0) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: seat },
          amount,
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
