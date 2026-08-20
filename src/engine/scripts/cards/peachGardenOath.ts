// `Peach Garden Oath` — "You gain 2 life for each creature you control."
// The census gain. D232.

import { PEACH_GARDEN_OATH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PEACH_GARDEN_OATH, 'You gain 2 life for each creature you control.');

export const PEACH_GARDEN_OATH_SCRIPT: CardScript = {
  oracleId: PEACH_GARDEN_OATH.oracleId,
  name: PEACH_GARDEN_OATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        n++;
      }
      if (n === 0) return [];
      return [
        { t: 'LifeChanged', player: obj.controller, delta: n * 2, to: player.life + n * 2 },
      ];
    },
  },
};
