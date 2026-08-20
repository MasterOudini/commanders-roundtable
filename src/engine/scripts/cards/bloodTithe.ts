// `Blood Tithe` — "Each opponent loses 3 life. You gain life equal to the
// life lost this way." The drain: every living opponent pays 3 and the
// caster banks the TOTAL — three opponents pay 9. D200.

import { BLOOD_TITHE } from '../../../data/fixtures/engineCards';
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
  BLOOD_TITHE,
  'Each opponent loses 3 life. You gain life equal to the life lost this way.',
);

export const BLOOD_TITHE_SCRIPT: CardScript = {
  oracleId: BLOOD_TITHE.oracleId,
  name: BLOOD_TITHE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      let total = 0;
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: -3, to: p.life - 3 });
        total += 3;
      }
      if (total > 0) {
        const me = ctx.state.players[obj.controller]?.life ?? 0;
        events.push({ t: 'LifeChanged', player: obj.controller, delta: total, to: me + total });
      }
      return events;
    },
  },
};
