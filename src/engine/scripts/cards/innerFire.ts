// `Inner Fire` — {R} per card in my hand: the computed ritual. D219.

import { INNER_FIRE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(INNER_FIRE, 'Add {R} for each card in your hand.');

export const INNER_FIRE_SCRIPT: CardScript = {
  oracleId: INNER_FIRE.oracleId,
  name: INNER_FIRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const n = (ctx.state.zones.hand[obj.controller] ?? []).length;
      if (n <= 0) return [];
      return [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, R: n }, source: self },
      ];
    },
  },
};
