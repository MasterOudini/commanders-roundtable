// `Keep Watch` — draw one per declared attacker, whosever they are.
// D221.

import { KEEP_WATCH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(KEEP_WATCH, 'Draw a card for each attacking creature.');

export const KEEP_WATCH_SCRIPT: CardScript = {
  oracleId: KEEP_WATCH.oracleId,
  name: KEEP_WATCH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const a of ctx.state.combat?.attackers ?? []) {
        if (ctx.state.cards[a.card]) n++;
      }
      if (n === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
