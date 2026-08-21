// `Starlight` — 3 life per BLACK creature the target opponent controls: the
// census reads derived colors, the opponent restriction is enforced. D252.

import { STARLIGHT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STARLIGHT, 'You gain 3 life for each black creature target opponent controls.');

export const STARLIGHT_SCRIPT: CardScript = {
  oracleId: STARLIGHT.oracleId,
  name: STARLIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.colors.includes('B')) n += 1;
      }
      if (n <= 0) return [];
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [
        { t: 'LifeChanged', player: obj.controller, delta: 3 * n, to: player.life + 3 * n },
      ];
    },
  },
};
