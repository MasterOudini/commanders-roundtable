// `Crushing Disappointment` — "Each player loses 2 life. You draw two
// cards." D205.

import { CRUSHING_DISAPPOINTMENT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CRUSHING_DISAPPOINTMENT, 'Each player loses 2 life. You draw two cards.');

export const CRUSHING_DISAPPOINTMENT_SCRIPT: CardScript = {
  oracleId: CRUSHING_DISAPPOINTMENT.oracleId,
  name: CRUSHING_DISAPPOINTMENT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const pid of ctx.state.seating) {
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: -2, to: p.life - 2 });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 2));
      return events;
    },
  },
};
