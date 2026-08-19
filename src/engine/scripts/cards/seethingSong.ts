// `Seething Song` — "Add {R}{R}{R}{R}{R}." The ritual shape at five — the
// same one-event resolve as Dark Ritual and Pyretic Ritual. D192.

import { SEETHING_SONG } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SEETHING_SONG, 'Add {R}{R}{R}{R}{R}.');

export const SEETHING_SONG_SCRIPT: CardScript = {
  oracleId: SEETHING_SONG.oracleId,
  name: SEETHING_SONG.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, R: 5 }, source: self },
      ];
    },
  },
};
