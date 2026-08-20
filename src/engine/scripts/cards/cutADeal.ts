// `Cut a Deal` — "Each opponent draws a card, then you draw a card for
// each opponent who drew a card this way." A living opponent with a
// library draws; the caster's count is who actually drew. D205.

import { CUT_A_DEAL } from '../../../data/fixtures/engineCards';
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
  CUT_A_DEAL,
  'Each opponent draws a card, then you draw a card for each opponent who drew a card this way.',
);

export const CUT_ADEAL_SCRIPT: CardScript = {
  oracleId: CUT_A_DEAL.oracleId,
  name: CUT_A_DEAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      let drew = 0;
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        events.push(...drawEvents(ctx.state, pid, 1));
        drew++;
      }
      if (drew > 0) events.push(...drawEvents(ctx.state, obj.controller, drew));
      return events;
    },
  },
};
