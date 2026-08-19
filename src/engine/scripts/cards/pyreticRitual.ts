// `Pyretic Ritual` — "Add {R}{R}{R}." Dark Ritual's red twin — the same
// one-event resolve, a different pool column. D192.

import { PYRETIC_RITUAL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { EMPTY_POOL } from '../../types/mana';

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

const TEXT = printed(PYRETIC_RITUAL, 'Add {R}{R}{R}.');

export const PYRETIC_RITUAL_SCRIPT: CardScript = {
  oracleId: PYRETIC_RITUAL.oracleId,
  name: PYRETIC_RITUAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, R: 3 }, source: self },
      ];
    },
  },
};
