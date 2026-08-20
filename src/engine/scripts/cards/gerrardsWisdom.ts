// `Gerrard's Wisdom` — "You gain 2 life for each card in your hand." The
// spell itself is on the stack and never counts. D215.

import { GERRARD_S_WISDOM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GERRARD_S_WISDOM, 'You gain 2 life for each card in your hand.');

export const GERRARDS_WISDOM_SCRIPT: CardScript = {
  oracleId: GERRARD_S_WISDOM.oracleId,
  name: GERRARD_S_WISDOM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const n = (ctx.state.zones.hand[obj.controller] ?? []).length;
      const me = ctx.state.players[obj.controller];
      if (n === 0 || !me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: 2 * n, to: me.life + 2 * n }];
    },
  },
};
