// `Minions' Murmurs` — "You draw X cards and you lose X life, where X is
// the number of creatures you control." Night's Whisper priced by the
// Massive Raid census. D225.

import { MINIONS_MURMURS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  MINIONS_MURMURS,
  'You draw X cards and you lose X life, where X is the number of creatures you control.',
);

export const MINIONS_MURMURS_SCRIPT: CardScript = {
  oracleId: MINIONS_MURMURS.oracleId,
  name: MINIONS_MURMURS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        x++;
      }
      if (x === 0) return [];
      return [
        ...drawEvents(ctx.state, obj.controller, x),
        { t: 'LifeChanged', player: obj.controller, delta: -x, to: player.life - x },
      ];
    },
  },
};
