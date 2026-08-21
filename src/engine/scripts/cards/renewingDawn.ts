// `Renewing Dawn` — "You gain 2 life for each Mountain target opponent
// controls." The per-their-board census gain. D239.

import { RENEWING_DAWN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RENEWING_DAWN, 'You gain 2 life for each Mountain target opponent controls.');

export const RENEWING_DAWN_SCRIPT: CardScript = {
  oracleId: RENEWING_DAWN.oracleId,
  name: RENEWING_DAWN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      let mountains = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Mountain')) mountains++;
      }
      const gain = 2 * mountains;
      const player = ctx.state.players[obj.controller];
      if (gain === 0 || !player || player.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: gain, to: player.life + gain }];
    },
  },
};
