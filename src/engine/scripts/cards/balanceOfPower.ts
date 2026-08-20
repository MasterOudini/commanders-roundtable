// `Balance of Power` — "If target opponent has more cards in hand than you,
// draw cards equal to the difference." The condition and the amount are both
// hand counts at resolution; the draws run through THE draw rule. D199.

import { BALANCE_OF_POWER } from '../../../data/fixtures/engineCards';
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
  BALANCE_OF_POWER,
  'If target opponent has more cards in hand than you, draw cards equal to the difference.',
);

export const BALANCE_OF_POWER_SCRIPT: CardScript = {
  oracleId: BALANCE_OF_POWER.oracleId,
  name: BALANCE_OF_POWER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const theirs = (ctx.state.zones.hand[target.id] ?? []).length;
      const mine = (ctx.state.zones.hand[obj.controller] ?? []).length;
      if (theirs <= mine) return [];
      return [...drawEvents(ctx.state, obj.controller, theirs - mine)];
    },
  },
};
