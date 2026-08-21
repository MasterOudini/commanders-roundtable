// `Prosperity` — "Each player draws X cards." Squall Line's X off the
// stack object, spent on every seat through THE draw rule. D235.

import { PROSPERITY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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

const TEXT = printed(PROSPERITY, 'Each player draws X cards.');

export const PROSPERITY_SCRIPT: CardScript = {
  oracleId: PROSPERITY.oracleId,
  name: PROSPERITY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x === 0) return [];
      const events: EventBody[] = [];
      for (const seat of ctx.state.seating) {
        const player = ctx.state.players[seat];
        if (!player || player.hasLost) continue;
        events.push(...drawEvents(ctx.state, seat, x));
      }
      return events;
    },
  },
};
