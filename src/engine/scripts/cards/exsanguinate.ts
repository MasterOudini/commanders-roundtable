// `Exsanguinate` — "Each opponent loses X life. You gain life equal to the
// life lost this way." Debt to the Deathless at 1×. D211.

import { EXSANGUINATE } from '../../../data/fixtures/engineCards';
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
  EXSANGUINATE,
  'Each opponent loses X life. You gain life equal to the life lost this way.',
);

export const EXSANGUINATE_SCRIPT: CardScript = {
  oracleId: EXSANGUINATE.oracleId,
  name: EXSANGUINATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const events: EventBody[] = [];
      let total = 0;
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: -x, to: p.life - x });
        total += x;
      }
      const me = ctx.state.players[obj.controller];
      if (total > 0 && me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: total, to: me.life + total });
      }
      return events;
    },
  },
};
