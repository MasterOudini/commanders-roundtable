// `Battle Hymn` — "Add {R} for each creature you control." Mana Geyser's
// shape with the count on MY creatures. D199.

import { BATTLE_HYMN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BATTLE_HYMN, 'Add {R} for each creature you control.');

export const BATTLE_HYMN_SCRIPT: CardScript = {
  oracleId: BATTLE_HYMN.oracleId,
  name: BATTLE_HYMN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (ctx.state.cards[id]?.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Creature')) n++;
      }
      if (n === 0) return [];
      return [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, R: n }, source: self },
      ];
    },
  },
};
