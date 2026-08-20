// `Infectious Inquiry` — Night's Whisper with a poison rider for each
// opponent. D219.

import { INFECTIOUS_INQUIRY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  INFECTIOUS_INQUIRY,
  'You draw two cards and you lose 2 life. Each opponent gets a poison counter.',
);

export const INFECTIOUS_INQUIRY_SCRIPT: CardScript = {
  oracleId: INFECTIOUS_INQUIRY.oracleId,
  name: INFECTIOUS_INQUIRY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 2)];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -2, to: me.life - 2 });
      }
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        events.push({ t: 'PoisonChanged', player: pid, delta: 1, to: p.poison + 1 });
      }
      return events;
    },
  },
};
