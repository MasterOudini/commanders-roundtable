// `Mana Geyser` — "Add {R} for each tapped land your opponents control." The
// first BOARD-COMPUTED ritual: the amount is a derived count at resolution —
// every opponent's tapped land, typed by DERIVED type line so an animated or
// type-changed permanent counts the way the rules count it. "Your opponents"
// is every other player still in the game (multiplayer is the format). D192.

import { MANA_GEYSER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MANA_GEYSER, 'Add {R} for each tapped land your opponents control.');

export const MANA_GEYSER_SCRIPT: CardScript = {
  oracleId: MANA_GEYSER.oracleId,
  name: MANA_GEYSER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller || !card.tapped) continue;
        if (ctx.state.players[card.controller]?.hasLost) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) n++;
      }
      if (n === 0) return [];
      return [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, R: n }, source: self },
      ];
    },
  },
};
