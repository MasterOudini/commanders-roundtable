// `Debt to the Deathless` — "Each opponent loses two times X life. You gain
// life equal to the life lost this way." The gain is the SUM ACTUALLY LOST,
// so a dead seat contributes nothing. D207.

import { DEBT_TO_THE_DEATHLESS } from '../../../data/fixtures/engineCards';
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
  DEBT_TO_THE_DEATHLESS,
  'Each opponent loses two times X life. You gain life equal to the life lost this way.',
);

export const DEBT_TO_THE_DEATHLESS_SCRIPT: CardScript = {
  oracleId: DEBT_TO_THE_DEATHLESS.oracleId,
  name: DEBT_TO_THE_DEATHLESS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const each = 2 * x;
      const events: EventBody[] = [];
      let total = 0;
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: -each, to: p.life - each });
        total += each;
      }
      const me = ctx.state.players[obj.controller];
      if (total > 0 && me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: total, to: me.life + total });
      }
      return events;
    },
  },
};
