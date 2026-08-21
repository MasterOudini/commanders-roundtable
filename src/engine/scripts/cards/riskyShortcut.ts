// `Risky Shortcut` — "Draw two cards. Each player loses 2 life." The
// draw through THE draw rule, then every living seat pays. D240.

import { RISKY_SHORTCUT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RISKY_SHORTCUT, 'Draw two cards. Each player loses 2 life.');

export const RISKY_SHORTCUT_SCRIPT: CardScript = {
  oracleId: RISKY_SHORTCUT.oracleId,
  name: RISKY_SHORTCUT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 2)];
      for (const seat of ctx.state.seating) {
        const player = ctx.state.players[seat];
        if (!player || player.hasLost) continue;
        events.push({ t: 'LifeChanged', player: seat, delta: -2, to: player.life - 2 });
      }
      return events;
    },
  },
};
