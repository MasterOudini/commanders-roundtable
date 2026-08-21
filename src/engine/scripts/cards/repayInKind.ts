// `Repay in Kind` — "Each player's life total becomes the lowest life
// total among all players." The life SET (a computed delta per seat,
// Biorhythm's rule). D239.

import { REPAY_IN_KIND } from '../../../data/fixtures/engineCards';
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
  REPAY_IN_KIND,
  "Each player's life total becomes the lowest life total among all players.",
);

export const REPAY_IN_KIND_SCRIPT: CardScript = {
  oracleId: REPAY_IN_KIND.oracleId,
  name: REPAY_IN_KIND.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      let lowest = Infinity;
      for (const seat of ctx.state.seating) {
        const player = ctx.state.players[seat];
        if (!player || player.hasLost) continue;
        if (player.life < lowest) lowest = player.life;
      }
      if (!Number.isFinite(lowest)) return [];
      const events: EventBody[] = [];
      for (const seat of ctx.state.seating) {
        const player = ctx.state.players[seat];
        if (!player || player.hasLost) continue;
        const delta = lowest - player.life;
        if (delta === 0) continue;
        events.push({ t: 'LifeChanged', player: seat, delta, to: lowest });
      }
      return events;
    },
  },
};
