// `Secret Rendezvous` — "You and target opponent each draw three
// cards." Both draws through THE draw rule. D245.

import { SECRET_RENDEZVOUS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SECRET_RENDEZVOUS, 'You and target opponent each draw three cards.');

export const SECRET_RENDEZVOUS_SCRIPT: CardScript = {
  oracleId: SECRET_RENDEZVOUS.oracleId,
  name: SECRET_RENDEZVOUS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const events: EventBody[] = [];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) events.push(...drawEvents(ctx.state, obj.controller, 3));
      const them = ctx.state.players[target.id];
      if (them && !them.hasLost) events.push(...drawEvents(ctx.state, target.id, 3));
      return events;
    },
  },
};
