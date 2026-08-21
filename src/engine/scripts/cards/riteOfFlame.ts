// `Rite of Flame` — "Add {R}{R}, then add {R} for each card named Rite
// of Flame in each graveyard." Inner Fire's ManaAdded with Feast of
// Flesh's name census; the copy resolving is ON THE STACK and correctly
// absent from its own count. D240.

import { RITE_OF_FLAME } from '../../../data/fixtures/engineCards';
import { EMPTY_POOL } from '../../types/mana';
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
  RITE_OF_FLAME,
  'Add {R}{R}, then add {R} for each card named Rite of Flame in each graveyard.',
);

export const RITE_OF_FLAME_SCRIPT: CardScript = {
  oracleId: RITE_OF_FLAME.oracleId,
  name: RITE_OF_FLAME.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      let named = 0;
      for (const pid of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[pid] ?? []) {
          const card = ctx.state.cards[id];
          if (!card) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name === 'Rite of Flame') named++;
        }
      }
      return [
        {
          t: 'ManaAdded',
          player: obj.controller,
          mana: { ...EMPTY_POOL, R: 2 + named },
          source: self,
        },
      ];
    },
  },
};
