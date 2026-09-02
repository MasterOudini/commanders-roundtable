// `Last Caress` — "Target player loses 1 life and you gain 1 life.\nDraw a
// card." A one-point drain aimed at any player (me included — then the two
// changes cancel), and a card. D277.

import { LAST_CARESS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LAST_CARESS, 'Target player loses 1 life and you gain 1 life.\nDraw a card.');

export const LAST_CARESS_SCRIPT: CardScript = {
  oracleId: LAST_CARESS.oracleId,
  name: LAST_CARESS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const them = ctx.state.players[target.id];
      if (!them || them.hasLost) return [];
      const events: EventBody[] = [{ t: 'LifeChanged', player: target.id, delta: -1, to: them.life - 1 }];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        // Read AFTER the loss when I am my own target: the two changes stack.
        const base = target.id === obj.controller ? them.life - 1 : me.life;
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 1, to: base + 1 });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
