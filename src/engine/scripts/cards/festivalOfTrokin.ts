// `Festival of Trokin` — "You gain 2 life for each creature you control."
// D213.

import { FESTIVAL_OF_TROKIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FESTIVAL_OF_TROKIN, 'You gain 2 life for each creature you control.');

export const FESTIVAL_OF_TROKIN_SCRIPT: CardScript = {
  oracleId: FESTIVAL_OF_TROKIN.oracleId,
  name: FESTIVAL_OF_TROKIN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Creature')) n++;
      }
      const me = ctx.state.players[obj.controller];
      if (n === 0 || !me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: 2 * n, to: me.life + 2 * n }];
    },
  },
};
