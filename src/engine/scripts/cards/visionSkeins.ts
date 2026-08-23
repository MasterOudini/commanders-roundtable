// `Vision Skeins` — EACH player draws two, in seating order, every draw
// through THE one draw rule so an empty library still loses correctly
// (D158/D189). D266.

import { VISION_SKEINS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(VISION_SKEINS, 'Each player draws two cards.');

export const VISION_SKEINS_SCRIPT: CardScript = {
  oracleId: VISION_SKEINS.oracleId,
  name: VISION_SKEINS.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const p of ctx.state.seating) {
        const player = ctx.state.players[p];
        if (!player || player.hasLost) continue;
        events.push(...drawEvents(ctx.state, p, 2));
      }
      return events;
    },
  },
};
