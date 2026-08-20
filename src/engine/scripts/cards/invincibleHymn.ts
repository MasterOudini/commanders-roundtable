// `Invincible Hymn` — my life BECOMES my library count: a set is a
// computed delta (Biorhythm's rule). D220.

import { INVINCIBLE_HYMN } from '../../../data/fixtures/engineCards';
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
  INVINCIBLE_HYMN,
  'Count the number of cards in your library. Your life total becomes that number.',
);

export const INVINCIBLE_HYMN_SCRIPT: CardScript = {
  oracleId: INVINCIBLE_HYMN.oracleId,
  name: INVINCIBLE_HYMN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const me = ctx.state.players[obj.controller];
      if (!me || me.hasLost) return [];
      const n = (ctx.state.zones.library[obj.controller] ?? []).length;
      const delta = n - me.life;
      if (delta === 0) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta, to: n }];
    },
  },
};
