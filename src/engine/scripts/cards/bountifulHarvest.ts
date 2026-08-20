// `Bountiful Harvest` — "You gain 1 life for each land you control." D201.

import { BOUNTIFUL_HARVEST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BOUNTIFUL_HARVEST, 'You gain 1 life for each land you control.');

export const BOUNTIFUL_HARVEST_SCRIPT: CardScript = {
  oracleId: BOUNTIFUL_HARVEST.oracleId,
  name: BOUNTIFUL_HARVEST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) n++;
      }
      if (n === 0) return [];
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      return [{ t: 'LifeChanged', player: obj.controller, delta: n, to: life + n }];
    },
  },
};
