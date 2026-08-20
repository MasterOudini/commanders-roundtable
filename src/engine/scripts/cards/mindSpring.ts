// `Mind Spring` — "Draw X cards." The plainest X draw there is, through THE
// one draw rule. D225.

import { MIND_SPRING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MIND_SPRING, 'Draw X cards.');

export const MIND_SPRING_SCRIPT: CardScript = {
  oracleId: MIND_SPRING.oracleId,
  name: MIND_SPRING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      return [...drawEvents(ctx.state, obj.controller, x)];
    },
  },
};
